import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowRequest,
  CollectedTransactionItem
} from '@personal-erp/contracts';
import { PlanItemStatus, Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodsService } from '../accounting-periods/accounting-periods.service';
import { readCollectingAccountingPeriodStatuses } from '../accounting-periods/accounting-period-transition.policy';
import { resolveImportedRowAutoPreparation } from './imported-row-auto-preparation.policy';
import { mapCreatedCollectedTransactionToItem } from './imported-row-collection.mapper';
import {
  assertImportedRowCanBeCollected,
  assertOccurredOnWithinPeriod,
  readNormalizedImportedRow
} from './imported-row-collection.normalization.policy';
import { resolveMatchedPlanItemCandidate } from './imported-row-collection-plan-item.policy';
import { resolveCollectedSourceFingerprint } from './imported-row-collection-source-fingerprint.policy';
import {
  collectableImportedRowSelect,
  collectingPeriodSelect,
  createdCollectedTransactionSelect,
  type CollectableImportedRow,
  type CollectingPeriodRecord,
  type CreatedCollectedTransactionRecord,
  type DraftPlanItemCandidate
} from './imported-row-collection.types';

type WorkspaceContext = ReturnType<typeof requireCurrentWorkspace>;
type PrismaClientLike = PrismaService | Prisma.TransactionClient;

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
    const parsedRow = readNormalizedImportedRow(importedRow);
    const currentPeriod =
      await this.accountingPeriodsService.assertCollectingDateAllowed(
        user,
        parsedRow.occurredOn
      );

    const created = await this.prisma.$transaction((tx) =>
      this.collectRowInTransaction({
        tx,
        workspace,
        importBatchId,
        importedRowId,
        input,
        currentPeriodId: currentPeriod.id
      })
    );

    return mapCreatedCollectedTransactionToItem(created, input.type);
  }

  private async collectRowInTransaction(input: {
    tx: Prisma.TransactionClient;
    workspace: WorkspaceContext;
    importBatchId: string;
    importedRowId: string;
    input: CollectImportedRowRequest;
    currentPeriodId: string;
  }): Promise<CreatedCollectedTransactionRecord> {
    const row = await this.readCollectableImportedRow(
      input.tx,
      input.workspace,
      input.importBatchId,
      input.importedRowId
    );
    const normalizedRow = readNormalizedImportedRow(row);
    const currentCollectingPeriod = await this.readCurrentCollectingPeriod(
      input.tx,
      input.workspace,
      input.currentPeriodId
    );
    const occurredOn = assertOccurredOnWithinPeriod(
      normalizedRow.occurredOn,
      currentCollectingPeriod
    );
    const fundingAccount = await this.readFundingAccount(
      input.tx,
      input.workspace,
      input.input.fundingAccountId
    );
    const ledgerTransactionType = await this.readLedgerTransactionType(
      input.tx,
      input.workspace,
      input.input.type
    );
    const matchedPlanItem = await this.readMatchedPlanItemCandidate(
      input.tx,
      input.workspace,
      currentCollectingPeriod.id,
      normalizedRow.amount,
      occurredOn,
      fundingAccount.id,
      ledgerTransactionType.id,
      input.input.categoryId ?? null
    );
    const sourceFingerprint = resolveCollectedSourceFingerprint({
      existingSourceFingerprint: row.sourceFingerprint,
      sourceKind: row.batch.sourceKind,
      occurredOn: normalizedRow.occurredOn,
      amount: normalizedRow.amount,
      title: normalizedRow.title
    });
    const hasDuplicateSourceFingerprint =
      await this.hasDuplicateSourceFingerprint(
        input.tx,
        input.workspace,
        sourceFingerprint
      );
    const autoPreparation = resolveImportedRowAutoPreparation({
      type: input.input.type,
      requestedCategoryId: input.input.categoryId ?? null,
      matchedPlanItemCategoryId: matchedPlanItem?.categoryId ?? null,
      hasDuplicateSourceFingerprint
    });
    const category = await this.readEffectiveCategory(
      input.tx,
      input.workspace,
      autoPreparation.effectiveCategoryId
    );
    const matchedPlanItemId =
      autoPreparation.allowPlanItemMatch && matchedPlanItem
        ? matchedPlanItem.id
        : null;
    const createdCollectedTransaction =
      await this.createCollectedTransactionRecord({
        tx: input.tx,
        workspace: input.workspace,
        importBatchId: input.importBatchId,
        importedRowId: row.id,
        periodId: currentCollectingPeriod.id,
        matchedPlanItemId,
        ledgerTransactionTypeId: ledgerTransactionType.id,
        fundingAccountId: fundingAccount.id,
        categoryId: category?.id ?? null,
        title: normalizedRow.title,
        occurredOn,
        amount: normalizedRow.amount,
        status: autoPreparation.nextStatus,
        sourceFingerprint,
        memo: input.input.memo
      });

    await this.markPlanItemMatched(input.tx, matchedPlanItemId);

    return createdCollectedTransaction;
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

  private async readMatchedPlanItemCandidate(
    tx: Prisma.TransactionClient,
    workspace: WorkspaceContext,
    periodId: string,
    amount: number,
    occurredOn: Date,
    fundingAccountId: string,
    ledgerTransactionTypeId: string,
    categoryId: string | null
  ): Promise<DraftPlanItemCandidate | null> {
    const candidates = await this.readDraftPlanItemCandidates(
      tx,
      workspace,
      periodId
    );

    return resolveMatchedPlanItemCandidate({
      candidates,
      amount,
      occurredOn,
      fundingAccountId,
      ledgerTransactionTypeId,
      categoryId
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

  private async createCollectedTransactionRecord(input: {
    tx: Prisma.TransactionClient;
    workspace: WorkspaceContext;
    importBatchId: string;
    importedRowId: string;
    periodId: string;
    matchedPlanItemId: string | null;
    ledgerTransactionTypeId: string;
    fundingAccountId: string;
    categoryId: string | null;
    title: string;
    occurredOn: Date;
    amount: number;
    status: Prisma.CollectedTransactionCreateInput['status'];
    sourceFingerprint: string;
    memo: string | undefined;
  }): Promise<CreatedCollectedTransactionRecord> {
    return input.tx.collectedTransaction.create({
      data: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        periodId: input.periodId,
        importBatchId: input.importBatchId,
        importedRowId: input.importedRowId,
        matchedPlanItemId: input.matchedPlanItemId,
        ledgerTransactionTypeId: input.ledgerTransactionTypeId,
        fundingAccountId: input.fundingAccountId,
        categoryId: input.categoryId,
        title: input.title,
        occurredOn: input.occurredOn,
        amount: input.amount,
        status: input.status,
        sourceFingerprint: input.sourceFingerprint,
        memo: input.memo
      },
      select: createdCollectedTransactionSelect
    });
  }

  private async markPlanItemMatched(
    tx: Prisma.TransactionClient,
    matchedPlanItemId: string | null
  ): Promise<void> {
    if (!matchedPlanItemId) {
      return;
    }

    await tx.planItem.update({
      where: {
        id: matchedPlanItemId
      },
      data: {
        status: PlanItemStatus.MATCHED
      }
    });
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
