import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse
} from '@personal-erp/contracts';
import {
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseMonthRange } from '../../common/utils/date.util';
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
  potentialDuplicateTransactionCount: number;
  preview: CollectImportedRowPreview;
};

type ResolvedCollectionPeriod = {
  id: string | null;
  year: number;
  month: number;
  monthLabel: string;
  startDate: Date;
  endDate: Date;
  willCreateOnCollect: boolean;
};

@Injectable()
export class ImportedRowCollectionService {
  constructor(
    private readonly prisma: PrismaService,
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
    const actorRef = readWorkspaceActorRef(workspace);

    return this.prisma.$transaction((tx) =>
      this.collectRowInTransaction({
        tx,
        workspace: workspaceScope,
        actorRef,
        importBatchId,
        importedRowId,
        input,
        occurredOnIso: parsedRow.occurredOn
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
    const targetPeriod = await this.resolveTargetCollectionPeriod({
      client: this.prisma,
      workspace: workspaceScope,
      occurredOnIso: parsedRow.occurredOn
    });

    const assessment = await this.evaluateRowCollection({
      client: this.prisma,
      workspace: workspaceScope,
      importBatchId,
      importedRowId,
      input,
      targetPeriod
    });

    return assessment.preview;
  }

  private async collectRowInTransaction(input: {
    tx: Prisma.TransactionClient;
    workspace: ImportedRowCollectionWorkspaceScope;
    actorRef: ReturnType<typeof readWorkspaceActorRef>;
    importBatchId: string;
    importedRowId: string;
    input: CollectImportedRowRequest;
    occurredOnIso: string;
  }): Promise<CollectImportedRowResponse> {
    const targetPeriod =
      await this.resolveOrCreateTargetCollectionPeriodInTransaction({
        tx: input.tx,
        workspace: input.workspace,
        actorRef: input.actorRef,
        occurredOnIso: input.occurredOnIso
      });
    const assessment = await this.evaluateRowCollection({
      client: input.tx,
      workspace: input.workspace,
      importBatchId: input.importBatchId,
      importedRowId: input.importedRowId,
      input: input.input,
      targetPeriod
    });
    this.assertPotentialDuplicateConfirmation(
      assessment.potentialDuplicateTransactionCount,
      input.input.confirmPotentialDuplicate
    );
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
              periodId: targetPeriod.id,
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
            periodId: targetPeriod.id,
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
    targetPeriod: ResolvedCollectionPeriod;
  }): Promise<RowCollectionAssessment> {
    const row = await this.collectionRepository.readCollectableImportedRow(
      input.client,
      input.workspace,
      input.importBatchId,
      input.importedRowId
    );
    const normalizedRow = readNormalizedImportedRow(row);
    const occurredOn = assertOccurredOnWithinPeriod(
      normalizedRow.occurredOn,
      input.targetPeriod
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
    const matchedPlanItem = input.targetPeriod.id
      ? await this.collectionRepository.readMatchedPlanItemCandidate(
          input.client,
          input.workspace,
          input.targetPeriod.id,
          normalizedRow.amount,
          occurredOn,
          fundingAccount.id,
          ledgerTransactionTypeId,
          input.input.categoryId ?? null
        )
      : null;
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
        sourceFingerprint,
        input.importBatchId
      );
    const potentialDuplicateTransactionCount =
      await this.collectionRepository.countPotentialDuplicateTransactions(
        input.client,
        input.workspace,
        occurredOn,
        normalizedRow.amount,
        ledgerTransactionTypeId,
        input.importBatchId,
        matchedPlanItem?.existingCollectedTransactionId
          ? [matchedPlanItem.existingCollectedTransactionId]
          : []
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
      allowPlanItemMatch: autoPreparation.allowPlanItemMatch,
      targetPeriodMonthLabel: input.targetPeriod.monthLabel,
      willCreateTargetPeriod: input.targetPeriod.willCreateOnCollect,
      potentialDuplicateTransactionCount
    });

    return {
      occurredOn,
      normalizedRow,
      ledgerTransactionTypeId,
      fundingAccount,
      matchedPlanItem,
      effectiveCategory,
      sourceFingerprint,
      potentialDuplicateTransactionCount,
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

  private async resolveTargetCollectionPeriod(input: {
    client: PrismaClientLike;
    workspace: ImportedRowCollectionWorkspaceScope;
    occurredOnIso: string;
  }): Promise<ResolvedCollectionPeriod> {
    const occurredOn = parseOccurredOn(input.occurredOnIso);
    const year = occurredOn.getUTCFullYear();
    const month = occurredOn.getUTCMonth() + 1;
    const existingPeriod = await input.client.accountingPeriod.findFirst({
      where: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        year,
        month
      },
      select: {
        id: true,
        year: true,
        month: true,
        startDate: true,
        endDate: true,
        status: true
      }
    });

    if (existingPeriod) {
      if (existingPeriod.status === AccountingPeriodStatus.LOCKED) {
        throw new BadRequestException(
          `${formatYearMonth(existingPeriod.year, existingPeriod.month)} 마감월 데이터이기 때문에 저장할 수 없습니다.`
        );
      }

      return {
        id: existingPeriod.id,
        year: existingPeriod.year,
        month: existingPeriod.month,
        monthLabel: formatYearMonth(existingPeriod.year, existingPeriod.month),
        startDate: existingPeriod.startDate,
        endDate: existingPeriod.endDate,
        willCreateOnCollect: false
      };
    }

    const monthLabel = formatYearMonth(year, month);
    const periodBoundary = parseMonthRange(monthLabel);

    return {
      id: null,
      year,
      month,
      monthLabel,
      startDate: periodBoundary.start,
      endDate: periodBoundary.end,
      willCreateOnCollect: true
    };
  }

  private async resolveOrCreateTargetCollectionPeriodInTransaction(input: {
    tx: Prisma.TransactionClient;
    workspace: ImportedRowCollectionWorkspaceScope;
    actorRef: ReturnType<typeof readWorkspaceActorRef>;
    occurredOnIso: string;
  }): Promise<ResolvedCollectionPeriod & { id: string }> {
    const targetPeriod = await this.resolveTargetCollectionPeriod({
      client: input.tx,
      workspace: input.workspace,
      occurredOnIso: input.occurredOnIso
    });

    if (targetPeriod.id) {
      return targetPeriod as ResolvedCollectionPeriod & { id: string };
    }

    try {
      const createdPeriod = await input.tx.accountingPeriod.create({
        data: {
          tenantId: input.workspace.tenantId,
          ledgerId: input.workspace.ledgerId,
          year: targetPeriod.year,
          month: targetPeriod.month,
          startDate: targetPeriod.startDate,
          endDate: targetPeriod.endDate,
          status: AccountingPeriodStatus.OPEN
        }
      });

      await input.tx.periodStatusHistory.create({
        data: {
          tenantId: input.workspace.tenantId,
          ledgerId: input.workspace.ledgerId,
          periodId: createdPeriod.id,
          fromStatus: null,
          toStatus: AccountingPeriodStatus.OPEN,
          eventType: AccountingPeriodEventType.OPEN,
          reason: `업로드 배치 거래 등록 자동 생성 (${targetPeriod.monthLabel})`,
          ...input.actorRef
        }
      });

      return {
        ...targetPeriod,
        id: createdPeriod.id
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const latestPeriod = await this.resolveTargetCollectionPeriod({
          client: input.tx,
          workspace: input.workspace,
          occurredOnIso: input.occurredOnIso
        });

        if (latestPeriod.id) {
          return latestPeriod as ResolvedCollectionPeriod & { id: string };
        }
      }

      throw error;
    }
  }

  private assertPotentialDuplicateConfirmation(
    potentialDuplicateTransactionCount: number,
    confirmPotentialDuplicate: boolean | undefined
  ) {
    if (
      potentialDuplicateTransactionCount < 1 ||
      confirmPotentialDuplicate === true
    ) {
      return;
    }

    throw new ConflictException(
      `같은 거래일·금액·입출금 유형의 기존 거래 ${potentialDuplicateTransactionCount}건이 있어 확인 없이 저장할 수 없습니다. 자동 판정 요약을 확인한 뒤 다시 등록해 주세요.`
    );
  }
}

function parseOccurredOn(occurredOnIso: string) {
  const occurredOn = new Date(`${occurredOnIso}T00:00:00.000Z`);

  if (Number.isNaN(occurredOn.getTime())) {
    throw new BadRequestException('거래일이 올바르지 않습니다.');
  }

  return occurredOn;
}

function formatYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}
