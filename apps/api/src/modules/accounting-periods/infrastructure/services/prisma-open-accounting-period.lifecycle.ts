import { Injectable } from '@nestjs/common';
import {
  conflictError,
  validationError
} from '../../../../common/application/errors/app-error';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  OpenAccountingPeriodRequest,
  OpeningBalancePreview,
  PreviewOpeningBalanceRequest
} from '@personal-erp/contracts';
import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import {
  AccountSubjectKind,
  AccountingPeriodEventType,
  AccountingPeriodStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import {
  readWorkspaceActorRef,
  readWorkspaceCreatedByActorRef
} from '../../../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
import { requirePositiveMoneyWon } from '../../../../common/money/money-won';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { OperationalAuditPublisher } from '../../../../common/infrastructure/operational/operational-audit-publisher.service';
import { publishPeriodStatusHistoryAudit } from '../../../../common/infrastructure/operational/period-status-history-audit';
import { parseMonthRange } from '../../../../common/utils/date.util';
import { mapAccountingPeriodRecordToItem } from '../../application/mappers/accounting-period.mapper';
import {
  normalizeMonthToken,
  normalizeOptionalText,
  readYearMonth
} from '../../domain/accounting-period.policy';
import { assertAccountingPeriodCanRecordInitialOpen } from '../../domain/accounting-period-transition.policy';
import {
  calculateAccountingEquationDifference,
  summarizeAccountingEquationLines
} from '../../domain/accounting-equation.policy';

/**
 * 새 운영월을 OPEN 상태로 시작하는 유스케이스입니다.
 *
 * 첫 월은 사용자가 입력한 기초 잔액으로 시작하고, 이후 월은 차기 이월이 만든 오프닝 스냅샷을 사용합니다.
 * 이 규칙을 분리해두면 월별 운영 체인이 "오픈 -> 수집/전표 -> 마감 -> 이월 -> 다음 오픈" 순서로 유지됩니다.
 */
@Injectable()
export class PrismaOpenAccountingPeriodLifecycle {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPublisher: OperationalAuditPublisher
  ) {}

  async preview(
    user: AuthenticatedUser,
    input: PreviewOpeningBalanceRequest
  ): Promise<OpeningBalancePreview> {
    const workspace = requireCurrentWorkspace(user);
    assertOpenPermission(workspace.membershipRole);

    const lineDrafts = normalizeOpeningBalanceLineDrafts(
      input.openingBalanceLines
    );
    if (lineDrafts.length === 0) {
      throw validationError(
        '기초 잔액 미리보기에는 최소 1건 이상의 라인이 필요합니다.'
      );
    }

    const [accountSubjects, fundingAccounts] = await Promise.all([
      this.prisma.accountSubject.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          isActive: true
        }
      }),
      this.prisma.account.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      })
    ]);

    return buildOpeningBalancePreview(
      buildValidatedOpeningBalanceLines({
        lineDrafts,
        accountSubjects,
        fundingAccounts
      })
    );
  }

  async execute(
    user: AuthenticatedUser,
    input: OpenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem> {
    const workspace = requireCurrentWorkspace(user);
    const actorRef = readWorkspaceActorRef(workspace);
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertOpenPermission(workspace.membershipRole);

    const monthToken = normalizeMonthToken(input.month);
    const { start, end } = parseMonthRange(monthToken);
    const { year, month } = readYearMonth(monthToken);

    const existingPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        ledgerId: workspace.ledgerId,
        year,
        month
      }
    });

    if (existingPeriod) {
      throw conflictError('해당 월 운영 기간이 이미 존재합니다.');
    }

    const latestPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    const isFirstPeriod = latestPeriod == null;
    const shouldCreateOpeningSnapshot = Boolean(input.initializeOpeningBalance);
    const openingBalanceLineDrafts = normalizeOpeningBalanceLineDrafts(
      input.openingBalanceLines
    );

    if (!isFirstPeriod) {
      throw conflictError(
        '첫 월 이후 운영 기간은 직접 열 수 없습니다. 최근 잠금 월에서 차기 이월을 생성해 다음 월을 시작해 주세요.'
      );
    }

    // 첫 운영월은 이전 마감 잔액이 없으므로 사용자가 직접 기초 잔액을 제공해야 한다.
    // 반대로 두 번째 달부터는 차기 이월이 오프닝 기준을 만들어야 하므로 직접 입력을 막는다.
    if (!shouldCreateOpeningSnapshot && openingBalanceLineDrafts.length > 0) {
      throw validationError(
        '오프닝 잔액 라인을 입력하려면 기초 잔액 기준 생성을 함께 선택해 주세요.'
      );
    }

    if (isFirstPeriod && !shouldCreateOpeningSnapshot) {
      throw validationError(
        '첫 월 운영 시작에는 오프닝 잔액 스냅샷 생성이 필요합니다.'
      );
    }

    if (isFirstPeriod && openingBalanceLineDrafts.length === 0) {
      throw validationError(
        '첫 월 운영 시작에는 최소 1건 이상의 오프닝 잔액 라인이 필요합니다.'
      );
    }

    assertAccountingPeriodCanRecordInitialOpen();

    const accountSubjects = shouldCreateOpeningSnapshot
      ? await this.prisma.accountSubject.findMany({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            isActive: true
          }
        })
      : [];
    const validatedOpeningBalanceLines = shouldCreateOpeningSnapshot
      ? buildValidatedOpeningBalanceLines({
          lineDrafts: openingBalanceLineDrafts,
          accountSubjects,
          fundingAccounts: await this.prisma.account.findMany({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            }
          })
        })
      : [];
    const openingBalancePlan = buildOpeningBalancePlan({
      lines: validatedOpeningBalanceLines,
      accountSubjects,
      adjustmentMode: input.openingBalanceAdjustmentMode ?? 'REJECT'
    });

    const { createdPeriod, createdStatusHistory, openingBalanceSnapshot } =
      await this.prisma.$transaction(async (tx) => {
        // 기간, 상태 이력, 선택적 기초 잔액 스냅샷은 하나의 운영 시작 단위이므로
        // 트랜잭션 안에서 함께 생성해 중간 상태가 남지 않게 한다.
        const createdPeriod = await tx.accountingPeriod.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            year,
            month,
            startDate: start,
            endDate: end,
            status: AccountingPeriodStatus.OPEN
          }
        });

        const createdStatusHistory = await tx.periodStatusHistory.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            periodId: createdPeriod.id,
            fromStatus: null,
            toStatus: AccountingPeriodStatus.OPEN,
            eventType: AccountingPeriodEventType.OPEN,
            reason: normalizeOptionalText(input.note),
            ...actorRef
          }
        });

        const openingBalanceSnapshot = shouldCreateOpeningSnapshot
          ? await tx.openingBalanceSnapshot.create({
              data: {
                tenantId: workspace.tenantId,
                ledgerId: workspace.ledgerId,
                effectivePeriodId: createdPeriod.id,
                sourceKind: 'INITIAL_SETUP',
                equityAdjustmentKind: openingBalancePlan.equityAdjustmentKind,
                equityAdjustmentAmount:
                  openingBalancePlan.equityAdjustmentAmount,
                ...createdByActorRef
              }
            })
          : null;

        if (openingBalanceSnapshot && openingBalancePlan.lines.length > 0) {
          await tx.balanceSnapshotLine.createMany({
            data: openingBalancePlan.lines.map((line) => ({
              snapshotKind: 'OPENING',
              openingSnapshotId: openingBalanceSnapshot.id,
              accountSubjectId: line.accountSubjectId,
              fundingAccountId: line.fundingAccountId,
              balanceAmount: line.balanceAmount
            }))
          });
        }

        return {
          createdPeriod,
          createdStatusHistory,
          openingBalanceSnapshot: openingBalanceSnapshot
            ? {
                sourceKind: openingBalanceSnapshot.sourceKind
              }
            : null
        };
      });

    publishPeriodStatusHistoryAudit(this.auditPublisher, createdStatusHistory);

    return mapAccountingPeriodRecordToItem({
      ...createdPeriod,
      openingBalanceSnapshot,
      statusHistory: [createdStatusHistory]
    });
  }
}

function assertOpenPermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'accounting_period.open');
}

function normalizeOpeningBalanceLineDrafts(
  lines: OpenAccountingPeriodRequest['openingBalanceLines']
) {
  return (lines ?? []).map((line) => ({
    accountSubjectId: line.accountSubjectId,
    fundingAccountId: normalizeOptionalIdentifier(line.fundingAccountId),
    balanceAmount: line.balanceAmount
  }));
}

function buildValidatedOpeningBalanceLines(input: {
  lineDrafts: Array<{
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: number;
  }>;
  accountSubjects: Array<{
    id: string;
    code: string;
    name: string;
    subjectKind: AccountSubjectKind;
    isActive: boolean;
  }>;
  fundingAccounts: Array<{
    id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  }>;
}) {
  // 첫 월 기초 잔액은 이후 모든 스냅샷의 시작점이므로 계정과목/자금수단/금액을 저장 전에 엄격히 검증한다.
  const accountSubjectById = new Map(
    input.accountSubjects.map((candidate) => [candidate.id, candidate])
  );
  const fundingAccountById = new Map(
    input.fundingAccounts
      .filter((candidate) => candidate.status !== 'CLOSED')
      .map((candidate) => [candidate.id, candidate])
  );
  const seenKeys = new Set<string>();

  return input.lineDrafts.map((line, index) => {
    // 기초 잔액은 재무상태표 계정만 허용한다. 수익/비용 계정은 기간 손익으로
    // 흘러야 하므로 오프닝 스냅샷에 직접 넣으면 다음 마감 합계가 왜곡된다.
    const accountSubject = accountSubjectById.get(line.accountSubjectId);
    if (!accountSubject) {
      throw validationError(
        `오프닝 잔액 라인 ${index + 1}의 계정과목을 찾을 수 없습니다.`
      );
    }

    if (!isOpeningBalanceSubjectKind(accountSubject.subjectKind)) {
      throw validationError(
        `오프닝 잔액 라인 ${index + 1}에는 재무상태표 계정과목만 사용할 수 있습니다.`
      );
    }

    if (
      line.fundingAccountId &&
      !fundingAccountById.has(line.fundingAccountId)
    ) {
      throw validationError(
        `오프닝 잔액 라인 ${index + 1}의 자금수단을 찾을 수 없습니다.`
      );
    }

    const lineKey = `${accountSubject.id}:${line.fundingAccountId ?? 'none'}`;
    if (seenKeys.has(lineKey)) {
      throw validationError(
        '동일한 계정과목과 자금수단 조합의 오프닝 잔액 라인은 한 번만 입력할 수 있습니다.'
      );
    }

    seenKeys.add(lineKey);

    return {
      accountSubjectId: accountSubject.id,
      accountSubjectKind: accountSubject.subjectKind,
      fundingAccountId: line.fundingAccountId,
      balanceAmount: requirePositiveMoneyWon(
        line.balanceAmount,
        `오프닝 잔액 라인 ${index + 1}의 금액은 0보다 큰 안전한 정수여야 합니다.`
      )
    };
  });
}

type ValidatedOpeningBalanceLine = ReturnType<
  typeof buildValidatedOpeningBalanceLines
>[number];

function buildOpeningBalancePreview(
  lines: ValidatedOpeningBalanceLine[]
): OpeningBalancePreview {
  const totals = summarizeAccountingEquationLines(
    lines.map((line) => ({
      accountSubjectKind: line.accountSubjectKind,
      balanceAmount: line.balanceAmount
    }))
  );
  const adjustmentAmount = calculateAccountingEquationDifference(totals);

  return {
    totalAssetAmount: totals.totalAssetAmount,
    totalLiabilityAmount: totals.totalLiabilityAmount,
    inputEquityAmount: totals.totalEquityAmount,
    adjustmentAmount,
    finalNetAssetsAmount: subtractMoneyWon(
      totals.totalAssetAmount,
      totals.totalLiabilityAmount
    ),
    isBalanced: adjustmentAmount === 0
  };
}

function buildOpeningBalancePlan(input: {
  lines: ValidatedOpeningBalanceLine[];
  accountSubjects: Array<{
    id: string;
    code: string;
    subjectKind: AccountSubjectKind;
  }>;
  adjustmentMode: 'REJECT' | 'AUTO_TO_NET_ASSETS';
}) {
  const preview = buildOpeningBalancePreview(input.lines);
  if (preview.isBalanced) {
    return {
      lines: input.lines,
      equityAdjustmentKind: null,
      equityAdjustmentAmount: 0
    } as const;
  }

  if (input.adjustmentMode !== 'AUTO_TO_NET_ASSETS') {
    throw validationError(
      `기초 잔액의 자산과 부채+자본 합계가 일치하지 않습니다. 차액 ${preview.adjustmentAmount}원을 3100 순자산으로 보정하려면 openingBalanceAdjustmentMode를 AUTO_TO_NET_ASSETS로 명시해 주세요.`
    );
  }

  const netAssetsSubject = input.accountSubjects.find(
    (candidate) =>
      candidate.code === '3100' && candidate.subjectKind === 'EQUITY'
  );
  if (!netAssetsSubject) {
    throw validationError(
      '기초 잔액 자동 보정에 필요한 3100 순자산 계정과목을 찾을 수 없습니다.'
    );
  }

  const lines = input.lines.map((line) => ({ ...line }));
  const existingIndex = lines.findIndex(
    (line) =>
      line.accountSubjectId === netAssetsSubject.id &&
      line.fundingAccountId === null
  );

  if (existingIndex >= 0) {
    const existing = lines[existingIndex]!;
    const adjustedAmount = addMoneyWon(
      existing.balanceAmount,
      preview.adjustmentAmount
    );

    if (adjustedAmount === 0) {
      lines.splice(existingIndex, 1);
    } else {
      lines[existingIndex] = {
        ...existing,
        balanceAmount: adjustedAmount
      };
    }
  } else {
    lines.push({
      accountSubjectId: netAssetsSubject.id,
      accountSubjectKind: 'EQUITY',
      fundingAccountId: null,
      balanceAmount: preview.adjustmentAmount
    });
  }

  return {
    lines,
    equityAdjustmentKind: 'INITIAL_AUTO_BALANCE',
    equityAdjustmentAmount: preview.adjustmentAmount
  } as const;
}

function isOpeningBalanceSubjectKind(subjectKind: AccountSubjectKind) {
  return (
    subjectKind === 'ASSET' ||
    subjectKind === 'LIABILITY' ||
    subjectKind === 'EQUITY'
  );
}

function normalizeOptionalIdentifier(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
