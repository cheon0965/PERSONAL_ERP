import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  FinancialStatementComparisonItem,
  FinancialStatementsView
} from '@personal-erp/contracts';
import { AccountingPeriodStatus, Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import { findPreviousLockedPeriod } from '../reporting/reporting-period-selection';
import { mapFinancialStatementSnapshotRecordToItem } from './financial-statement-snapshot.mapper';
import { sortFinancialStatementSnapshots } from './financial-statement-payload.policy';

const financialStatementPeriodInclude =
  Prisma.validator<Prisma.AccountingPeriodInclude>()({
    ledger: {
      select: {
        baseCurrency: true
      }
    },
    openingBalanceSnapshot: {
      select: {
        sourceKind: true
      }
    },
    statusHistory: {
      orderBy: {
        changedAt: 'desc'
      },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        eventType: true,
        reason: true,
        actorType: true,
        actorMembershipId: true,
        changedAt: true
      }
    }
  });

type FinancialStatementPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof financialStatementPeriodInclude;
}>;

const financialStatementSnapshotInclude =
  Prisma.validator<Prisma.FinancialStatementSnapshotInclude>()({
    period: {
      select: {
        year: true,
        month: true
      }
    }
  });

@Injectable()
export class FinancialStatementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findView(
    user: AuthenticatedUser,
    periodId?: string
  ): Promise<FinancialStatementsView | null> {
    const workspace = requireCurrentWorkspace(user);

    return this.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      periodId
    );
  }

  async findViewInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId?: string
  ): Promise<FinancialStatementsView | null> {
    const period = await this.findTargetPeriodInWorkspace(
      tenantId,
      ledgerId,
      periodId
    );
    if (!period) {
      return null;
    }

    return this.buildView(period);
  }

  async findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<FinancialStatementPeriodRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      },
      include: financialStatementPeriodInclude
    });
  }

  async findSnapshotsInPeriod(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ) {
    const snapshots = await this.prisma.financialStatementSnapshot.findMany({
      where: {
        tenantId,
        ledgerId,
        periodId
      },
      include: financialStatementSnapshotInclude
    });

    return sortFinancialStatementSnapshots(
      snapshots.map(mapFinancialStatementSnapshotRecordToItem)
    );
  }

  private async buildView(
    period: FinancialStatementPeriodRecord
  ): Promise<FinancialStatementsView> {
    const [snapshots, periods, carryForwardRecord] = await Promise.all([
      this.findSnapshotsInPeriod(period.tenantId, period.ledgerId, period.id),
      this.prisma.accountingPeriod.findMany({
        where: {
          tenantId: period.tenantId,
          ledgerId: period.ledgerId
        },
        include: financialStatementPeriodInclude,
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }),
      this.prisma.carryForwardRecord.findFirst({
        where: {
          tenantId: period.tenantId,
          ledgerId: period.ledgerId,
          toPeriodId: period.id
        }
      })
    ]);
    const previousPeriod = findPreviousLockedPeriod(periods, period.id);
    const previousSnapshots = previousPeriod
      ? await this.findSnapshotsInPeriod(
          period.tenantId,
          period.ledgerId,
          previousPeriod.id
        )
      : [];
    const sourcePeriod = carryForwardRecord
      ? (periods.find(
          (candidate) => candidate.id === carryForwardRecord.fromPeriodId
        ) ?? null)
      : null;

    return {
      period: mapAccountingPeriodRecordToItem(period),
      previousPeriod: previousPeriod
        ? mapAccountingPeriodRecordToItem(previousPeriod)
        : null,
      basis: {
        openingBalanceSourceKind:
          period.openingBalanceSnapshot?.sourceKind ?? null,
        carryForwardRecordId: carryForwardRecord?.id ?? null,
        sourceClosingSnapshotId:
          carryForwardRecord?.sourceClosingSnapshotId ?? null,
        sourcePeriodId: sourcePeriod?.id ?? null,
        sourceMonthLabel: sourcePeriod
          ? `${sourcePeriod.year}-${String(sourcePeriod.month).padStart(2, '0')}`
          : null
      },
      snapshots,
      comparison: buildFinancialStatementComparison(
        snapshots,
        previousSnapshots
      ),
      warnings: buildWarnings({
        currentPeriod: period,
        previousPeriod,
        snapshots,
        previousSnapshots
      })
    };
  }

  private async findTargetPeriodInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId?: string
  ): Promise<FinancialStatementPeriodRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        ledgerId,
        ...(periodId
          ? { id: periodId }
          : {
              status: AccountingPeriodStatus.LOCKED
            })
      },
      include: financialStatementPeriodInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  }
}

function buildFinancialStatementComparison(
  currentSnapshots: Awaited<
    ReturnType<FinancialStatementsService['findSnapshotsInPeriod']>
  >,
  previousSnapshots: Awaited<
    ReturnType<FinancialStatementsService['findSnapshotsInPeriod']>
  >
): FinancialStatementComparisonItem[] {
  return currentSnapshots.map((snapshot) => {
    const previousSnapshot =
      previousSnapshots.find(
        (candidate) => candidate.statementKind === snapshot.statementKind
      ) ?? null;
    const metricLabels = new Set([
      ...snapshot.payload.summary.map((item) => item.label),
      ...(previousSnapshot?.payload.summary.map((item) => item.label) ?? [])
    ]);

    return {
      statementKind: snapshot.statementKind,
      metrics: [...metricLabels].map((label) => {
        const currentMetric = snapshot.payload.summary.find(
          (item) => item.label === label
        );
        const previousMetric = previousSnapshot?.payload.summary.find(
          (item) => item.label === label
        );
        const currentAmountWon = currentMetric?.amountWon ?? 0;
        const previousAmountWon = previousMetric?.amountWon ?? null;
        const deltaWon =
          previousAmountWon === null
            ? null
            : currentAmountWon - previousAmountWon;
        const deltaRate =
          previousAmountWon === null ||
          previousAmountWon === 0 ||
          deltaWon === null
            ? null
            : deltaWon / Math.abs(previousAmountWon);

        return {
          label,
          currentAmountWon,
          previousAmountWon,
          deltaWon,
          deltaRate
        };
      })
    };
  });
}

function buildWarnings(input: {
  currentPeriod: FinancialStatementPeriodRecord;
  previousPeriod: FinancialStatementPeriodRecord | null;
  snapshots: Awaited<
    ReturnType<FinancialStatementsService['findSnapshotsInPeriod']>
  >;
  previousSnapshots: Awaited<
    ReturnType<FinancialStatementsService['findSnapshotsInPeriod']>
  >;
}) {
  const warnings: string[] = [];

  if (input.currentPeriod.status !== AccountingPeriodStatus.LOCKED) {
    warnings.push(
      '선택한 기간이 잠금되지 않아 공식 비교 기준으로는 아직 완전하지 않습니다.'
    );
  }

  if (input.snapshots.length === 0) {
    warnings.push('이 기간의 공식 재무제표 스냅샷이 아직 생성되지 않았습니다.');
  }

  if (!input.previousPeriod) {
    warnings.push('직전 잠금 기간이 없어 전기 대비 비교는 비어 있습니다.');
  } else if (input.previousSnapshots.length === 0) {
    warnings.push(
      '직전 잠금 기간은 있지만 비교할 공식 스냅샷이 아직 없습니다.'
    );
  }

  return warnings;
}
