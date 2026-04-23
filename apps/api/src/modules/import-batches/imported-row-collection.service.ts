import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Injectable
} from '@nestjs/common';
import { isMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import type {
  AuthenticatedUser,
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse
} from '@personal-erp/contracts';
import {
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  BalanceSnapshotKind,
  OpeningBalanceSourceKind,
  Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseMonthRange } from '../../common/utils/date.util';
import { readCollectingAccountingPeriodStatuses } from '../accounting-periods/public';
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
import type { ParsedImportedRowPayload } from './import-batch.policy';
import { mapCreatedCollectedTransactionToItem } from './imported-row-collection.mapper';
import {
  assertOccurredOnWithinPeriod,
  readNormalizedImportedRow
} from './imported-row-collection.normalization.policy';
import { resolveCollectedSourceFingerprint } from './imported-row-collection-source-fingerprint.policy';
import type { PlanItemCollectionCandidate } from './imported-row-collection.types';

type RowCollectionAssessment = {
  occurredOn: Date;
  normalizedRow: ParsedImportedRowPayload;
  ledgerTransactionTypeId: string;
  fundingAccount: {
    id: string;
    name: string;
    type: 'BANK' | 'CASH' | 'CARD';
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
  creationReason: 'INITIAL_SETUP' | 'NEW_FUNDING_ACCOUNT' | null;
};

type CollectionPeriodRecord = {
  id: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: AccountingPeriodStatus;
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
        occurredOnIso: parsedRow.occurredOn,
        fundingAccountId: input.fundingAccountId
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
      importBatchId,
      occurredOnIso: parsedRow.occurredOn,
      fundingAccountId: input.fundingAccountId
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
    fundingAccountId: string;
  }): Promise<CollectImportedRowResponse> {
    const targetPeriod =
      await this.resolveOrCreateTargetCollectionPeriodInTransaction({
        tx: input.tx,
        workspace: input.workspace,
        actorRef: input.actorRef,
        importBatchId: input.importBatchId,
        occurredOnIso: input.occurredOnIso,
        fundingAccountId: input.fundingAccountId
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
    await this.createOpeningBalanceFromImportedBalanceIfNeeded({
      tx: input.tx,
      workspace: input.workspace,
      actorRef: input.actorRef,
      targetPeriod,
      normalizedRow: assessment.normalizedRow,
      fundingAccount: assessment.fundingAccount
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
    await this.markFundingAccountBootstrapCompletedIfPending({
      tx: input.tx,
      workspace: input.workspace,
      fundingAccountId: assessment.fundingAccount.id
    });

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
      targetPeriodCreationReason: input.targetPeriod.creationReason,
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
    importBatchId: string;
    occurredOnIso: string;
    fundingAccountId: string;
  }): Promise<ResolvedCollectionPeriod> {
    const occurredOn = parseOccurredOn(input.occurredOnIso);
    const year = occurredOn.getUTCFullYear();
    const month = occurredOn.getUTCMonth() + 1;
    const periods = (await input.client.accountingPeriod.findMany({
      where: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId
      },
      select: {
        id: true,
        year: true,
        month: true,
        startDate: true,
        endDate: true,
        status: true
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })) as CollectionPeriodRecord[];
    const existingPeriod =
      periods.find(
        (candidate) => candidate.year === year && candidate.month === month
      ) ?? null;
    const latestCollectingPeriod =
      periods.find((candidate) =>
        isCollectingAccountingPeriodStatus(candidate.status)
      ) ?? null;

    if (existingPeriod) {
      if (existingPeriod.status === AccountingPeriodStatus.LOCKED) {
        throw new BadRequestException(
          `${formatYearMonth(existingPeriod.year, existingPeriod.month)} 마감월 데이터이기 때문에 저장할 수 없습니다.`
        );
      }

      if (
        !isCollectingAccountingPeriodStatus(existingPeriod.status) ||
        (latestCollectingPeriod &&
          existingPeriod.id !== latestCollectingPeriod.id)
      ) {
        const latestMonthLabel = latestCollectingPeriod
          ? formatYearMonth(
              latestCollectingPeriod.year,
              latestCollectingPeriod.month
            )
          : '없음';
        throw new BadRequestException(
          `${formatYearMonth(existingPeriod.year, existingPeriod.month)} 업로드 행은 최신 진행월 ${latestMonthLabel} 범위가 아니어서 등록할 수 없습니다. 운영 중에는 열린 최신 월 거래만 업로드 배치에서 수집 거래로 올릴 수 있습니다.`
        );
      }

      return {
        id: existingPeriod.id,
        year: existingPeriod.year,
        month: existingPeriod.month,
        monthLabel: formatYearMonth(existingPeriod.year, existingPeriod.month),
        startDate: existingPeriod.startDate,
        endDate: existingPeriod.endDate,
        willCreateOnCollect: false,
        creationReason: null
      };
    }

    const monthLabel = formatYearMonth(year, month);
    const periodBoundary = parseMonthRange(monthLabel);
    const latestPeriod = periods[0] ?? null;
    const canCreateInitialSetupPeriod = latestPeriod == null;
    const canCreateNewFundingAccountPeriod =
      latestPeriod?.status === AccountingPeriodStatus.LOCKED &&
      isImmediatelyAfter(latestPeriod, { year, month }) &&
      (await this.isNewFundingAccountBootstrapCandidate({
        client: input.client,
        workspace: input.workspace,
        currentImportBatchId: input.importBatchId,
        fundingAccountId: input.fundingAccountId
      }));

    if (!canCreateInitialSetupPeriod && !canCreateNewFundingAccountPeriod) {
      throw new BadRequestException(
        `${monthLabel} 운영월은 업로드 배치에서 자동으로 추가할 수 없습니다. 운영 중에는 월 운영 화면에서 최신 진행월을 먼저 열고 해당 월 거래만 등록해 주세요.`
      );
    }

    return {
      id: null,
      year,
      month,
      monthLabel,
      startDate: periodBoundary.start,
      endDate: periodBoundary.end,
      willCreateOnCollect: true,
      creationReason: canCreateNewFundingAccountPeriod
        ? 'NEW_FUNDING_ACCOUNT'
        : 'INITIAL_SETUP'
    };
  }

  private async resolveOrCreateTargetCollectionPeriodInTransaction(input: {
    tx: Prisma.TransactionClient;
    workspace: ImportedRowCollectionWorkspaceScope;
    actorRef: ReturnType<typeof readWorkspaceActorRef>;
    importBatchId: string;
    occurredOnIso: string;
    fundingAccountId: string;
  }): Promise<ResolvedCollectionPeriod & { id: string }> {
    const targetPeriod = await this.resolveTargetCollectionPeriod({
      client: input.tx,
      workspace: input.workspace,
      importBatchId: input.importBatchId,
      occurredOnIso: input.occurredOnIso,
      fundingAccountId: input.fundingAccountId
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
          reason:
            targetPeriod.creationReason === 'NEW_FUNDING_ACCOUNT'
              ? `신규 계좌/카드 기초 업로드 자동 생성 (${targetPeriod.monthLabel})`
              : `업로드 배치 거래 등록 자동 생성 (${targetPeriod.monthLabel})`,
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
          importBatchId: input.importBatchId,
          occurredOnIso: input.occurredOnIso,
          fundingAccountId: input.fundingAccountId
        });

        if (latestPeriod.id) {
          return latestPeriod as ResolvedCollectionPeriod & { id: string };
        }
      }

      throw error;
    }
  }

  private async createOpeningBalanceFromImportedBalanceIfNeeded(input: {
    tx: Prisma.TransactionClient;
    workspace: ImportedRowCollectionWorkspaceScope;
    actorRef: ReturnType<typeof readWorkspaceActorRef>;
    targetPeriod: ResolvedCollectionPeriod & { id: string };
    normalizedRow: ParsedImportedRowPayload;
    fundingAccount: {
      id: string;
      type: 'BANK' | 'CASH' | 'CARD';
    };
  }): Promise<void> {
    if (!input.targetPeriod.willCreateOnCollect) {
      return;
    }

    const openingBalanceAmount = resolveImportedOpeningBalanceAmount(
      input.normalizedRow
    );
    if (openingBalanceAmount == null) {
      return;
    }

    const accountSubjectId =
      await this.resolveOpeningBalanceAccountSubjectId({
        tx: input.tx,
        workspace: input.workspace,
        fundingAccountType: input.fundingAccount.type
      });

    const openingBalanceSnapshot =
      await input.tx.openingBalanceSnapshot.create({
        data: {
          tenantId: input.workspace.tenantId,
          ledgerId: input.workspace.ledgerId,
          effectivePeriodId: input.targetPeriod.id,
          sourceKind: OpeningBalanceSourceKind.INITIAL_SETUP,
          createdByActorType: input.actorRef.actorType,
          createdByMembershipId: input.actorRef.actorMembershipId
        }
      });

    await input.tx.balanceSnapshotLine.createMany({
      data: [
        {
          snapshotKind: BalanceSnapshotKind.OPENING,
          openingSnapshotId: openingBalanceSnapshot.id,
          accountSubjectId,
          fundingAccountId: input.fundingAccount.id,
          balanceAmount: openingBalanceAmount
        }
      ]
    });
  }

  private async resolveOpeningBalanceAccountSubjectId(input: {
    tx: Prisma.TransactionClient;
    workspace: ImportedRowCollectionWorkspaceScope;
    fundingAccountType: 'BANK' | 'CASH' | 'CARD';
  }): Promise<string> {
    const expected = resolveOpeningBalanceAccountSubject(
      input.fundingAccountType
    );
    const accountSubjects = await input.tx.accountSubject.findMany({
      where: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        code: {
          in: [expected.code]
        },
        isActive: true
      },
      select: {
        id: true,
        code: true,
        subjectKind: true
      }
    });
    const accountSubject =
      accountSubjects.find(
        (candidate) =>
          candidate.code === expected.code &&
          candidate.subjectKind === expected.subjectKind
      ) ?? null;

    if (!accountSubject) {
      throw new InternalServerErrorException(
        `현재 Ledger에 업로드 기초금액용 기본 계정과목 ${expected.code}이 준비되어 있지 않습니다.`
      );
    }

    return accountSubject.id;
  }

  private async isNewFundingAccountBootstrapCandidate(input: {
    client: PrismaClientLike;
    workspace: ImportedRowCollectionWorkspaceScope;
    currentImportBatchId: string;
    fundingAccountId: string;
  }): Promise<boolean> {
    const fundingAccount = await input.client.account.findFirst({
      where: {
        id: input.fundingAccountId,
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId
      },
      select: {
        type: true,
        status: true,
        bootstrapStatus: true
      }
    });

    if (
      !fundingAccount ||
      fundingAccount.status !== 'ACTIVE' ||
      fundingAccount.bootstrapStatus !== 'PENDING' ||
      !['BANK', 'CARD'].includes(fundingAccount.type)
    ) {
      return false;
    }

    const [
      existingTransactions,
      existingImportBatches,
      existingJournalLines,
      existingBalanceSnapshotLines
    ] = await Promise.all([
      input.client.collectedTransaction.findMany({
        where: {
          tenantId: input.workspace.tenantId,
          ledgerId: input.workspace.ledgerId,
          fundingAccountId: input.fundingAccountId
        },
        select: {
          id: true
        },
        take: 1
      }),
      input.client.importBatch.findMany({
        where: {
          tenantId: input.workspace.tenantId,
          ledgerId: input.workspace.ledgerId,
          fundingAccountId: input.fundingAccountId,
          id: {
            not: input.currentImportBatchId
          }
        },
        select: {
          id: true
        },
        take: 1
      }),
      input.client.journalLine.findMany({
        where: {
          fundingAccountId: input.fundingAccountId,
          journalEntry: {
            tenantId: input.workspace.tenantId,
            ledgerId: input.workspace.ledgerId
          }
        },
        select: {
          id: true
        },
        take: 1
      }),
      input.client.balanceSnapshotLine.findMany({
        where: {
          fundingAccountId: input.fundingAccountId,
          OR: [
            {
              openingSnapshot: {
                is: {
                  tenantId: input.workspace.tenantId,
                  ledgerId: input.workspace.ledgerId
                }
              }
            },
            {
              closingSnapshot: {
                is: {
                  tenantId: input.workspace.tenantId,
                  ledgerId: input.workspace.ledgerId
                }
              }
            }
          ]
        },
        select: {
          id: true
        },
        take: 1
      })
    ]);

    return (
      existingTransactions.length === 0 &&
      existingImportBatches.length === 0 &&
      existingJournalLines.length === 0 &&
      existingBalanceSnapshotLines.length === 0
    );
  }

  private async markFundingAccountBootstrapCompletedIfPending(input: {
    tx: Prisma.TransactionClient;
    workspace: ImportedRowCollectionWorkspaceScope;
    fundingAccountId: string;
  }): Promise<void> {
    await input.tx.account.updateMany({
      where: {
        id: input.fundingAccountId,
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        bootstrapStatus: 'PENDING'
      },
      data: {
        bootstrapStatus: 'COMPLETED'
      }
    });
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

function isCollectingAccountingPeriodStatus(
  status: AccountingPeriodStatus
): boolean {
  return readCollectingAccountingPeriodStatuses().some(
    (candidate) => candidate === status
  );
}

function isImmediatelyAfter(
  left: Pick<CollectionPeriodRecord, 'year' | 'month'>,
  right: Pick<CollectionPeriodRecord, 'year' | 'month'>
) {
  const nextMonth = left.month === 12 ? 1 : left.month + 1;
  const nextYear = left.month === 12 ? left.year + 1 : left.year;

  return right.year === nextYear && right.month === nextMonth;
}

function resolveImportedOpeningBalanceAmount(
  parsedRow: ParsedImportedRowPayload
) {
  if (
    !isMoneyWon(parsedRow.balanceAfter) ||
    !isMoneyWon(parsedRow.signedAmount)
  ) {
    return null;
  }

  try {
    return subtractMoneyWon(parsedRow.balanceAfter, parsedRow.signedAmount);
  } catch {
    return null;
  }
}

function resolveOpeningBalanceAccountSubject(
  fundingAccountType: 'BANK' | 'CASH' | 'CARD'
): {
  code: '1010' | '2100';
  subjectKind: 'ASSET' | 'LIABILITY';
} {
  if (fundingAccountType === 'CARD') {
    return {
      code: '2100',
      subjectKind: 'LIABILITY'
    };
  }

  return {
    code: '1010',
    subjectKind: 'ASSET'
  };
}
