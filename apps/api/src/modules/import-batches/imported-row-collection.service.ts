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

/**
 * 업로드 행을 수집 거래로 승격하는 서비스입니다.
 *
 * 이 서비스는 단순 저장보다 많은 운영 판단을 담당합니다. 업로드 행 파싱 결과를 기준으로 대상 운영월을 찾거나 만들고,
 * 계획 항목 매칭, 중복 후보 확인, 신규 계좌 bootstrap 기초 잔액 생성, 수집 거래 생성/흡수를 한 흐름으로 묶습니다.
 */
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
    // 단건 승격의 공개 진입점입니다. 권한과 원본 행 존재 여부를 확인한 뒤 실제 저장은 트랜잭션 내부 전용 함수로 넘깁니다.
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
    // 미리보기는 저장하지 않지만 실제 collect와 같은 평가 함수를 사용한다.
    // 사용자가 보는 자동분류/중복/계획매칭 결과와 저장 직전 판단이 최대한 같아지게 하기 위해서다.
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
    // 미리보기와 실제 등록이 같은 판정 규칙을 쓰도록 평가 결과를 트랜잭션 안에서 다시 계산한다.
    // 이렇게 해야 카테고리 보완, 계획 매칭, 중복 후보 판단이 저장 직전 상태를 기준으로 맞춰진다.
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
    // 이미 계획 생성 단계에서 만들어 둔 연결 수집 거래가 있으면 새 거래를 만들지 않고
    // 업로드 행 정보를 흡수한다. 계획 기반 거래와 실제 업로드 거래가 중복되는 것을 막는다.
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
    // 업로드 행 승격의 핵심 판정 함수입니다.
    // 여기서 결정한 기간, 거래유형, 카테고리, 계획 매칭, 중복 정보가 미리보기와 실제 저장에 공통으로 쓰입니다.
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
    // 원본 지문은 같은 업로드 원본/행이 다시 들어오는 경우를 잡고,
    // 잠재 중복 후보는 수기 입력 또는 다른 배치에서 이미 등록된 유사 거래를 사용자에게 확인시킨다.
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

    // 업로드가 운영월을 자동 생성할 수 있는 경우는 두 가지뿐이다.
    // 첫 시작월 초기화 또는 마감 직후 신규 계좌/카드 기초 업로드다.
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

    // 신규 자금수단 bootstrap은 "아직 이 계좌/카드가 어떤 회계 흔적도 갖지 않은" 경우에만 허용한다.
    // 이미 거래, 배치, 전표, 스냅샷이 있으면 업로드로 기초 잔액을 다시 만들면 안 된다.
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
