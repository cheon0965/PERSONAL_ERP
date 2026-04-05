import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse
} from '@personal-erp/contracts';
import { PlanItemStatus, Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodsService } from '../accounting-periods/accounting-periods.service';
import { readCollectingAccountingPeriodStatuses } from '../accounting-periods/accounting-period-transition.policy';
import { resolveImportedRowAutoPreparation } from './imported-row-auto-preparation.policy';
import {
  buildCollectImportedRowPreview,
  buildImportedRowAutoPreparationSummary
} from './imported-row-auto-preparation-summary';
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
type RowCollectionAssessment = {
  occurredOn: Date;
  normalizedRow: {
    occurredOn: string;
    title: string;
    amount: number;
  };
  ledgerTransactionTypeId: string;
  fundingAccount: {
    id: string;
    name: string;
  };
  matchedPlanItem: DraftPlanItemCandidate | null;
  effectiveCategory: {
    id: string;
    name: string;
  } | null;
  sourceFingerprint: string;
  preview: CollectImportedRowPreview;
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
  ): Promise<CollectImportedRowResponse> {
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

    return this.prisma.$transaction((tx) =>
      this.collectRowInTransaction({
        tx,
        workspace,
        importBatchId,
        importedRowId,
        input,
        currentPeriodId: currentPeriod.id
      })
    );
  }

  async previewRow(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectImportedRowPreview> {
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

    const assessment = await this.evaluateRowCollection({
      client: this.prisma,
      workspace,
      importBatchId,
      importedRowId,
      input,
      currentPeriodId: currentPeriod.id
    });

    return assessment.preview;
  }

  private async collectRowInTransaction(input: {
    tx: Prisma.TransactionClient;
    workspace: WorkspaceContext;
    importBatchId: string;
    importedRowId: string;
    input: CollectImportedRowRequest;
    currentPeriodId: string;
  }): Promise<CollectImportedRowResponse> {
    const assessment = await this.evaluateRowCollection({
      client: input.tx,
      workspace: input.workspace,
      importBatchId: input.importBatchId,
      importedRowId: input.importedRowId,
      input: input.input,
      currentPeriodId: input.currentPeriodId
    });
    const matchedPlanItemId =
      assessment.preview.autoPreparation.allowPlanItemMatch &&
      assessment.matchedPlanItem
        ? assessment.matchedPlanItem.id
        : null;
    const createdCollectedTransaction =
      await this.createCollectedTransactionRecord({
        tx: input.tx,
        workspace: input.workspace,
        importBatchId: input.importBatchId,
        importedRowId: input.importedRowId,
        periodId: input.currentPeriodId,
        matchedPlanItemId,
        ledgerTransactionTypeId: assessment.ledgerTransactionTypeId,
        fundingAccountId: assessment.fundingAccount.id,
        categoryId: assessment.effectiveCategory?.id ?? null,
        title: assessment.normalizedRow.title,
        occurredOn: assessment.occurredOn,
        amount: assessment.normalizedRow.amount,
        status: assessment.preview.autoPreparation
          .nextWorkflowStatus as Prisma.CollectedTransactionCreateInput['status'],
        sourceFingerprint: assessment.sourceFingerprint,
        memo: input.input.memo
      });

    await this.markPlanItemMatched(input.tx, matchedPlanItemId);

    return {
      collectedTransaction: mapCreatedCollectedTransactionToItem(
        createdCollectedTransaction,
        input.input.type
      ),
      preview: assessment.preview
    };
  }

  private async evaluateRowCollection(input: {
    client: PrismaClientLike;
    workspace: WorkspaceContext;
    importBatchId: string;
    importedRowId: string;
    input: CollectImportedRowRequest;
    currentPeriodId: string;
  }): Promise<RowCollectionAssessment> {
    const row = await this.readCollectableImportedRow(
      input.client,
      input.workspace,
      input.importBatchId,
      input.importedRowId
    );
    const normalizedRow = readNormalizedImportedRow(row);
    const currentCollectingPeriod = await this.readCurrentCollectingPeriod(
      input.client,
      input.workspace,
      input.currentPeriodId
    );
    const occurredOn = assertOccurredOnWithinPeriod(
      normalizedRow.occurredOn,
      currentCollectingPeriod
    );
    const fundingAccount = await this.readFundingAccount(
      input.client,
      input.workspace,
      input.input.fundingAccountId
    );
    const ledgerTransactionTypeId = await this.readLedgerTransactionTypeId(
      input.client,
      input.workspace,
      input.input.type
    );
    const matchedPlanItem = await this.readMatchedPlanItemCandidate(
      input.client,
      input.workspace,
      currentCollectingPeriod.id,
      normalizedRow.amount,
      occurredOn,
      fundingAccount.id,
      ledgerTransactionTypeId,
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
        input.client,
        input.workspace,
        sourceFingerprint
      );
    const autoPreparation = resolveImportedRowAutoPreparation({
      type: input.input.type,
      requestedCategoryId: input.input.categoryId ?? null,
      matchedPlanItemCategoryId: matchedPlanItem?.categoryId ?? null,
      hasDuplicateSourceFingerprint
    });
    const effectiveCategory = await this.readEffectiveCategory(
      input.client,
      input.workspace,
      autoPreparation.effectiveCategoryId
    );
    const requestedCategoryName = input.input.categoryId
      ? effectiveCategory?.name ?? null
      : null;
    const autoPreparationSummary = buildImportedRowAutoPreparationSummary({
      type: input.input.type,
      requestedCategoryId: input.input.categoryId ?? null,
      matchedPlanItemId: matchedPlanItem?.id ?? null,
      matchedPlanItemTitle: matchedPlanItem?.title ?? null,
      effectiveCategoryId: effectiveCategory?.id ?? null,
      effectiveCategoryName: effectiveCategory?.name ?? null,
      nextWorkflowStatus: autoPreparation.nextStatus,
      hasDuplicateSourceFingerprint,
      allowPlanItemMatch: autoPreparation.allowPlanItemMatch
    });

    return {
      occurredOn,
      normalizedRow,
      ledgerTransactionTypeId,
      fundingAccount,
      matchedPlanItem,
      effectiveCategory,
      sourceFingerprint,
      preview: buildCollectImportedRowPreview({
        importedRowId: row.id,
        occurredOn,
        title: normalizedRow.title,
        amountWon: normalizedRow.amount,
        fundingAccountId: fundingAccount.id,
        fundingAccountName: fundingAccount.name,
        type: input.input.type,
        requestedCategoryId: input.input.categoryId ?? null,
        requestedCategoryName,
        autoPreparation: autoPreparationSummary
      })
    };
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
    tx: PrismaClientLike,
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
    tx: PrismaClientLike,
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

  private async readLedgerTransactionTypeId(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    type: CollectImportedRowRequest['type']
  ): Promise<string> {
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

    return ledgerTransactionType.id;
  }

  private async readDraftPlanItemCandidates(
    tx: PrismaClientLike,
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
        title: true,
        plannedAmount: true,
        plannedDate: true,
        fundingAccountId: true,
        ledgerTransactionTypeId: true,
        categoryId: true
      }
    });
  }

  private async readMatchedPlanItemCandidate(
    tx: PrismaClientLike,
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
    tx: PrismaClientLike,
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
    tx: PrismaClientLike,
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
