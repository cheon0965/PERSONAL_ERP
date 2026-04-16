import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse
} from '@personal-erp/contracts';
import { Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodWriteGuardPort } from '../accounting-periods/public';
import {
  ImportedRowCollectionPort,
  type ImportedRowCollectionWorkspaceScope,
  type PrismaClientLike
} from './application/ports/imported-row-collection.port';
import { resolveImportedRowAutoPreparation } from './imported-row-auto-preparation.policy';
import {
  buildCollectImportedRowPreview,
  buildImportedRowAutoPreparationSummary
} from './imported-row-auto-preparation-summary';
import { mapCreatedCollectedTransactionToItem } from './imported-row-collection.mapper';
import {
  assertOccurredOnWithinPeriod,
  readNormalizedImportedRow
} from './imported-row-collection.normalization.policy';
import { resolveCollectedSourceFingerprint } from './imported-row-collection-source-fingerprint.policy';
import type { PlanItemCollectionCandidate } from './imported-row-collection.types';

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
  matchedPlanItem: PlanItemCollectionCandidate | null;
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
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort,
    private readonly collectionRepository: ImportedRowCollectionPort
  ) {}

  async collectRow(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectImportedRowResponse> {
    const workspace = requireCurrentWorkspace(user);
    const workspaceScope = {
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    };
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.create'
    );

    const importedRow =
      await this.collectionRepository.readCollectableImportedRow(
        this.prisma,
        workspaceScope,
        importBatchId,
        importedRowId
      );
    const parsedRow = readNormalizedImportedRow(importedRow);
    const currentPeriod =
      await this.accountingPeriodWriteGuard.assertCollectingDateAllowed(
        workspaceScope,
        parsedRow.occurredOn
      );

    return this.prisma.$transaction((tx) =>
      this.collectRowInTransaction({
        tx,
        workspace: workspaceScope,
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
    const workspaceScope = {
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    };
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.create'
    );

    const importedRow =
      await this.collectionRepository.readCollectableImportedRow(
        this.prisma,
        workspaceScope,
        importBatchId,
        importedRowId
      );
    const parsedRow = readNormalizedImportedRow(importedRow);
    const currentPeriod =
      await this.accountingPeriodWriteGuard.assertCollectingDateAllowed(
        workspaceScope,
        parsedRow.occurredOn
      );

    const assessment = await this.evaluateRowCollection({
      client: this.prisma,
      workspace: workspaceScope,
      importBatchId,
      importedRowId,
      input,
      currentPeriodId: currentPeriod.id
    });

    return assessment.preview;
  }

  private async collectRowInTransaction(input: {
    tx: Prisma.TransactionClient;
    workspace: ImportedRowCollectionWorkspaceScope;
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
    const matchedPlanItem = assessment.preview.autoPreparation
      .allowPlanItemMatch
      ? assessment.matchedPlanItem
      : null;
    const matchedPlanItemId = matchedPlanItem?.id ?? null;
    const createdCollectedTransaction =
      matchedPlanItem?.existingCollectedTransactionId && matchedPlanItem
        ? await this.collectionRepository.absorbImportedRowIntoCollectedTransactionRecord(
            {
              tx: input.tx,
              collectedTransactionId:
                matchedPlanItem.existingCollectedTransactionId,
              matchedPlanItemId: matchedPlanItem.id,
              importBatchId: input.importBatchId,
              importedRowId: input.importedRowId,
              periodId: input.currentPeriodId,
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
            }
          )
        : await this.collectionRepository.createCollectedTransactionRecord({
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

    await this.collectionRepository.markPlanItemMatched(
      input.tx,
      matchedPlanItemId
    );

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
    workspace: ImportedRowCollectionWorkspaceScope;
    importBatchId: string;
    importedRowId: string;
    input: CollectImportedRowRequest;
    currentPeriodId: string;
  }): Promise<RowCollectionAssessment> {
    const row = await this.collectionRepository.readCollectableImportedRow(
      input.client,
      input.workspace,
      input.importBatchId,
      input.importedRowId
    );
    const normalizedRow = readNormalizedImportedRow(row);
    const currentCollectingPeriod =
      await this.collectionRepository.readCurrentCollectingPeriod(
        input.client,
        input.workspace,
        input.currentPeriodId
      );
    const occurredOn = assertOccurredOnWithinPeriod(
      normalizedRow.occurredOn,
      currentCollectingPeriod
    );
    const fundingAccount = await this.collectionRepository.readFundingAccount(
      input.client,
      input.workspace,
      input.input.fundingAccountId
    );
    const ledgerTransactionTypeId =
      await this.collectionRepository.readLedgerTransactionTypeId(
        input.client,
        input.workspace,
        input.input.type
      );
    const matchedPlanItem =
      await this.collectionRepository.readMatchedPlanItemCandidate(
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
      await this.collectionRepository.hasDuplicateSourceFingerprint(
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
    const effectiveCategory =
      await this.collectionRepository.readEffectiveCategory(
        input.client,
        input.workspace,
        autoPreparation.effectiveCategoryId
      );
    const requestedCategoryName = input.input.categoryId
      ? (effectiveCategory?.name ?? null)
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
}
