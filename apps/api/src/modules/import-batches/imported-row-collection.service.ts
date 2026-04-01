import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowRequest,
  CollectedTransactionItem
} from '@personal-erp/contracts';
import {
  ImportSourceKind,
  ImportedRowParseStatus,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodsService } from '../accounting-periods/accounting-periods.service';
import { readCollectingAccountingPeriodStatuses } from '../accounting-periods/accounting-period-transition.policy';
import {
  buildSourceFingerprint,
  readParsedImportedRowPayload
} from './import-batch.policy';
import { resolveImportedRowAutoPreparation } from './imported-row-auto-preparation.policy';
import { resolvePlanItemAutoMatch } from './imported-row-plan-item-match.policy';

const createdCollectedTransactionSelect =
  Prisma.validator<Prisma.CollectedTransactionSelect>()({
    id: true,
    occurredOn: true,
    title: true,
    amount: true,
    fundingAccount: {
      select: {
        name: true
      }
    },
    category: {
      select: {
        name: true
      }
    }
  });

const collectableImportedRowSelect =
  Prisma.validator<Prisma.ImportedRowSelect>()({
    id: true,
    parseStatus: true,
    rawPayload: true,
    sourceFingerprint: true,
    createdCollectedTransaction: {
      select: {
        id: true
      }
    },
    batch: {
      select: {
        sourceKind: true
      }
    }
  });

const collectingPeriodSelect =
  Prisma.validator<Prisma.AccountingPeriodSelect>()({
    id: true,
    startDate: true,
    endDate: true
  });

type WorkspaceContext = ReturnType<typeof requireCurrentWorkspace>;
type PrismaClientLike = PrismaService | Prisma.TransactionClient;

type CreatedCollectedTransactionRecord = Prisma.CollectedTransactionGetPayload<{
  select: typeof createdCollectedTransactionSelect;
}>;

type CollectableImportedRow = Prisma.ImportedRowGetPayload<{
  select: typeof collectableImportedRowSelect;
}>;

type CollectingPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  select: typeof collectingPeriodSelect;
}>;

type DraftPlanItemCandidate = {
  id: string;
  plannedAmount: number;
  plannedDate: Date;
  fundingAccountId: string;
  ledgerTransactionTypeId: string;
  categoryId: string | null;
};

@Injectable()
export class ImportedRowCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodsService: AccountingPeriodsService
  ) {}

  async collectRow(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectedTransactionItem> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.create'
    );

    const importedRow = await this.readCollectableImportedRow(
      this.prisma,
      workspace,
      importBatchId,
      importedRowId
    );
    const parsedRow = this.readNormalizedImportedRow(importedRow);
    const currentPeriod =
      await this.accountingPeriodsService.assertCollectingDateAllowed(
        user,
        parsedRow.occurredOn
      );

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await this.readCollectableImportedRow(
        tx,
        workspace,
        importBatchId,
        importedRowId
      );
      const normalizedRow = this.readNormalizedImportedRow(row);
      const currentCollectingPeriod = await this.readCurrentCollectingPeriod(
        tx,
        workspace,
        currentPeriod.id
      );
      const occurredOn = assertOccurredOnWithinPeriod(
        normalizedRow.occurredOn,
        currentCollectingPeriod
      );
      const fundingAccount = await this.readFundingAccount(
        tx,
        workspace,
        input.fundingAccountId
      );
      const ledgerTransactionType = await this.readLedgerTransactionType(
        tx,
        workspace,
        input.type
      );
      const planItemCandidates = await this.readDraftPlanItemCandidates(
        tx,
        workspace,
        currentCollectingPeriod.id
      );
      const matchedPlanItem = resolveMatchedPlanItem({
        candidates: planItemCandidates,
        amount: normalizedRow.amount,
        occurredOn,
        fundingAccountId: fundingAccount.id,
        ledgerTransactionTypeId: ledgerTransactionType.id,
        categoryId: input.categoryId ?? null
      });
      const sourceFingerprint =
        row.sourceFingerprint ??
        buildSourceFingerprint({
          sourceKind: row.batch.sourceKind,
          occurredOn: normalizedRow.occurredOn,
          amount: normalizedRow.amount,
          description: normalizedRow.title,
          sourceOrigin: null
        });
      const hasDuplicateSourceFingerprint = sourceFingerprint
        ? await this.hasDuplicateSourceFingerprint(
            tx,
            workspace,
            sourceFingerprint
          )
        : false;
      const autoPreparation = resolveImportedRowAutoPreparation({
        type: input.type,
        requestedCategoryId: input.categoryId ?? null,
        matchedPlanItemCategoryId: matchedPlanItem?.categoryId ?? null,
        hasDuplicateSourceFingerprint
      });
      const category = await this.readEffectiveCategory(
        tx,
        workspace,
        autoPreparation.effectiveCategoryId
      );
      const matchedPlanItemId =
        autoPreparation.allowPlanItemMatch && matchedPlanItem
          ? matchedPlanItem.id
          : null;

      const createdCollectedTransaction = await tx.collectedTransaction.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: currentCollectingPeriod.id,
          importBatchId,
          importedRowId: row.id,
          matchedPlanItemId,
          ledgerTransactionTypeId: ledgerTransactionType.id,
          fundingAccountId: fundingAccount.id,
          categoryId: category?.id ?? null,
          title: normalizedRow.title,
          occurredOn,
          amount: normalizedRow.amount,
          status: autoPreparation.nextStatus,
          sourceFingerprint,
          memo: input.memo
        },
        select: createdCollectedTransactionSelect
      });

      if (matchedPlanItemId) {
        await tx.planItem.update({
          where: {
            id: matchedPlanItemId
          },
          data: {
            status: PlanItemStatus.MATCHED
          }
        });
      }

      return createdCollectedTransaction;
    });

    return mapCreatedCollectedTransactionToItem(created, input.type);
  }

  private async readCollectableImportedRow(
    client: PrismaClientLike,
    workspace: WorkspaceContext,
    importBatchId: string,
    importedRowId: string
  ): Promise<CollectableImportedRow> {
    const row = await client.importedRow.findFirst({
      where: {
        id: importedRowId,
        batchId: importBatchId,
        batch: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      },
      select: collectableImportedRowSelect
    });

    assertImportedRowCanBeCollected(row);
    return row;
  }

  private readNormalizedImportedRow(row: CollectableImportedRow) {
    const parsedRow = readParsedImportedRowPayload(row.rawPayload);
    if (!parsedRow) {
      throw new BadRequestException(
        '파싱 완료 행의 정규화 결과를 읽을 수 없습니다.'
      );
    }

    return parsedRow;
  }

  private async readCurrentCollectingPeriod(
    tx: Prisma.TransactionClient,
    workspace: WorkspaceContext,
    periodId: string
  ): Promise<CollectingPeriodRecord> {
    const currentCollectingPeriod = await tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: {
          in: [...readCollectingAccountingPeriodStatuses()]
        }
      },
      select: collectingPeriodSelect
    });

    if (!currentCollectingPeriod) {
      throw new BadRequestException(
        '현재 Ledger에 열린 운영 기간이 없어 수집 거래를 등록할 수 없습니다.'
      );
    }

    return currentCollectingPeriod;
  }

  private async readFundingAccount(
    tx: Prisma.TransactionClient,
    workspace: WorkspaceContext,
    fundingAccountId: string
  ): Promise<{ id: string; name: string }> {
    const fundingAccount = await tx.account.findFirst({
      where: {
        id: fundingAccountId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!fundingAccount) {
      throw new NotFoundException('Funding account not found');
    }

    return fundingAccount;
  }

  private async readLedgerTransactionType(
    tx: Prisma.TransactionClient,
    workspace: WorkspaceContext,
    type: CollectImportedRowRequest['type']
  ): Promise<{ id: string }> {
    const ledgerTransactionType = await tx.ledgerTransactionType.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        code: mapCollectedTransactionTypeToLedgerTransactionCode(type),
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (!ledgerTransactionType) {
      throw new InternalServerErrorException(
        '현재 Ledger에 수집 거래용 기본 거래유형 마스터가 준비되어 있지 않습니다.'
      );
    }

    return ledgerTransactionType;
  }

  private async readDraftPlanItemCandidates(
    tx: Prisma.TransactionClient,
    workspace: WorkspaceContext,
    periodId: string
  ): Promise<DraftPlanItemCandidate[]> {
    return tx.planItem.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId,
        status: PlanItemStatus.DRAFT,
        matchedCollectedTransaction: {
          is: null
        }
      },
      select: {
        id: true,
        plannedAmount: true,
        plannedDate: true,
        fundingAccountId: true,
        ledgerTransactionTypeId: true,
        categoryId: true
      }
    });
  }

  private async hasDuplicateSourceFingerprint(
    tx: Prisma.TransactionClient,
    workspace: WorkspaceContext,
    sourceFingerprint: string
  ): Promise<boolean> {
    const duplicateSourceFingerprint = await tx.collectedTransaction.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        sourceFingerprint
      },
      select: {
        id: true
      }
    });

    return Boolean(duplicateSourceFingerprint);
  }

  private async readEffectiveCategory(
    tx: Prisma.TransactionClient,
    workspace: WorkspaceContext,
    categoryId: string | null
  ): Promise<{ id: string; name: string } | null> {
    if (!categoryId) {
      return null;
    }

    const category = await tx.category.findFirst({
      where: {
        id: categoryId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }
}

function assertOccurredOnWithinPeriod(
  occurredOnIso: string,
  currentCollectingPeriod: CollectingPeriodRecord
): Date {
  const occurredOn = new Date(`${occurredOnIso}T00:00:00.000Z`);

  if (
    occurredOn.getTime() < currentCollectingPeriod.startDate.getTime() ||
    occurredOn.getTime() >= currentCollectingPeriod.endDate.getTime()
  ) {
    throw new BadRequestException(
      '수집 거래 일자는 현재 열린 운영 기간 안에 있어야 합니다.'
    );
  }

  return occurredOn;
}

function resolveMatchedPlanItem(input: {
  candidates: DraftPlanItemCandidate[];
  amount: number;
  occurredOn: Date;
  fundingAccountId: string;
  ledgerTransactionTypeId: string;
  categoryId: string | null;
}): DraftPlanItemCandidate | null {
  const planItemMatch = resolvePlanItemAutoMatch({
    candidates: input.candidates,
    collected: {
      amount: input.amount,
      occurredOn: input.occurredOn,
      fundingAccountId: input.fundingAccountId,
      ledgerTransactionTypeId: input.ledgerTransactionTypeId,
      categoryId: input.categoryId
    }
  });

  if (planItemMatch.outcome !== 'matched') {
    return null;
  }

  return (
    input.candidates.find(
      (candidate) => candidate.id === planItemMatch.planItemId
    ) ?? null
  );
}

function assertImportedRowCanBeCollected(
  row: CollectableImportedRow | null
): asserts row is CollectableImportedRow {
  if (!row) {
    throw new NotFoundException('업로드 행을 찾을 수 없습니다.');
  }

  if (row.parseStatus !== ImportedRowParseStatus.PARSED) {
    throw new BadRequestException(
      '파싱 완료 행만 수집 거래로 승격할 수 있습니다.'
    );
  }

  if (row.createdCollectedTransaction) {
    throw new ConflictException('이미 수집 거래로 승격된 업로드 행입니다.');
  }
}

function mapCollectedTransactionTypeToLedgerTransactionCode(
  type: CollectImportedRowRequest['type']
): string {
  switch (type) {
    case 'INCOME':
      return 'INCOME_BASIC';
    case 'TRANSFER':
      return 'TRANSFER_BASIC';
    case 'EXPENSE':
    default:
      return 'EXPENSE_BASIC';
  }
}

function mapCreatedCollectedTransactionToItem(
  transaction: CreatedCollectedTransactionRecord,
  type: CollectImportedRowRequest['type']
): CollectedTransactionItem {
  return {
    id: transaction.id,
    businessDate: transaction.occurredOn.toISOString().slice(0, 10),
    title: transaction.title,
    type,
    amountWon: transaction.amount,
    fundingAccountName: transaction.fundingAccount.name,
    categoryName: transaction.category?.name ?? '-',
    sourceKind: 'IMPORT',
    postingStatus: 'PENDING',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null
  };
}
