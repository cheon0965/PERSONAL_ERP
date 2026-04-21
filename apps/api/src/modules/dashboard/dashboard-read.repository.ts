import { Injectable } from '@nestjs/common';
import type { ReportingBasisStatus } from '@personal-erp/contracts';
import { sumMoneyWon } from '@personal-erp/money';
import { AccountingPeriodStatus, Prisma } from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { readWorkspaceCurrentFundingBalanceWon } from '../funding-accounts/funding-account-live-balance.reader';
import {
  findLatestLockedPeriod,
  findPreviousLockedPeriod,
  selectOperationalPeriod
} from '../reporting/reporting-period-selection';

const dashboardPeriodInclude =
  Prisma.validator<Prisma.AccountingPeriodInclude>()({
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

type DashboardPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof dashboardPeriodInclude;
}>;

type DashboardJournalLineRecord = {
  debitAmount: number;
  creditAmount: number;
  accountSubject: {
    subjectKind: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  };
};

type DashboardPlanItemRecord = {
  plannedAmount: number;
  status: 'DRAFT' | 'MATCHED' | 'CONFIRMED' | 'SKIPPED' | 'EXPIRED';
  ledgerTransactionTypeId: string;
};

type DashboardClosingSnapshotRecord = {
  totalAssetAmount: number;
  totalLiabilityAmount: number;
  periodPnLAmount: number;
  cashBalanceWon: number;
};

export type DashboardTrendPeriodReadModel = {
  period: Pick<DashboardPeriodRecord, 'id' | 'year' | 'month' | 'status'>;
  journalLines: DashboardJournalLineRecord[];
  planItems: DashboardPlanItemRecord[];
  closingSnapshot: DashboardClosingSnapshotRecord | null;
};

export type DashboardSummaryReadModel = {
  targetPeriod: DashboardPeriodRecord;
  basisStatus: ReportingBasisStatus;
  minimumReserveWon: number | null;
  currentFundingBalanceWon: number;
  targetJournalLines: DashboardJournalLineRecord[];
  targetPlanItems: DashboardPlanItemRecord[];
  targetClosingSnapshot: DashboardClosingSnapshotRecord | null;
  ledgerTransactionTypes: Array<{
    id: string;
    flowKind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  }>;
  comparisonPeriod: Pick<
    DashboardPeriodRecord,
    'id' | 'year' | 'month' | 'status'
  > | null;
  comparisonClosingSnapshot: DashboardClosingSnapshotRecord | null;
  trend: DashboardTrendPeriodReadModel[];
};

@Injectable()
export class DashboardReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummaryReadModel(input: {
    userId: string;
    tenantId: string;
    ledgerId: string;
    periodId?: string;
  }): Promise<DashboardSummaryReadModel | null> {
    const [user, periods, currentFundingBalanceWon, ledgerTransactionTypes] =
      await Promise.all(
      [
        this.prisma.user.findUniqueOrThrow({
          where: { id: input.userId },
          select: {
            settings: {
              select: {
                minimumReserveWon: true
              }
            }
          }
        }),
        this.prisma.accountingPeriod.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          include: dashboardPeriodInclude,
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        }),
        readWorkspaceCurrentFundingBalanceWon(this.prisma, {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId
        }),
        this.prisma.ledgerTransactionType.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId,
            isActive: true
          }
        })
      ]);

    const targetPeriod = selectOperationalPeriod(periods, input.periodId);
    if (!targetPeriod) {
      return null;
    }

    const latestLockedPeriod = findLatestLockedPeriod(periods);
    const comparisonPeriod =
      targetPeriod.status === AccountingPeriodStatus.LOCKED
        ? findPreviousLockedPeriod(periods, targetPeriod.id)
        : latestLockedPeriod;

    const trendPeriods = periods.slice(0, 4);
    const periodsToLoad = dedupePeriods([
      targetPeriod,
      ...(comparisonPeriod ? [comparisonPeriod] : []),
      ...trendPeriods
    ]);

    const periodMetrics = await Promise.all(
      periodsToLoad.map(async (period) => {
        const [journalLines, planItems, closingSnapshot] = await Promise.all([
          this.prisma.journalLine.findMany({
            where: {
              journalEntry: {
                tenantId: input.tenantId,
                ledgerId: input.ledgerId,
                periodId: period.id,
                status: 'POSTED'
              }
            },
            include: {
              accountSubject: {
                select: {
                  subjectKind: true
                }
              }
            }
          }),
          this.prisma.planItem.findMany({
            where: {
              tenantId: input.tenantId,
              ledgerId: input.ledgerId,
              periodId: period.id
            }
          }),
          loadClosingSnapshotMetrics(this.prisma, period.id)
        ]);

        return [
          period.id,
          {
            period: {
              id: period.id,
              year: period.year,
              month: period.month,
              status: period.status
            },
            journalLines: journalLines.map(mapDashboardJournalLineRecord),
            planItems: planItems.map(mapDashboardPlanItemRecord),
            closingSnapshot
          }
        ] as const;
      })
    );

    const metricsByPeriodId = new Map(periodMetrics);
    return {
      targetPeriod,
      basisStatus:
        targetPeriod.status === AccountingPeriodStatus.LOCKED
          ? 'OFFICIAL_LOCKED'
          : 'LIVE_OPERATIONS',
      minimumReserveWon:
        user.settings?.minimumReserveWon == null
          ? null
          : fromPrismaMoneyWon(user.settings.minimumReserveWon),
      currentFundingBalanceWon,
      targetJournalLines:
        metricsByPeriodId.get(targetPeriod.id)?.journalLines ?? [],
      targetPlanItems: metricsByPeriodId.get(targetPeriod.id)?.planItems ?? [],
      targetClosingSnapshot:
        metricsByPeriodId.get(targetPeriod.id)?.closingSnapshot ?? null,
      ledgerTransactionTypes: ledgerTransactionTypes.reduce<
        Array<{
          id: string;
          flowKind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
        }>
      >((items, item) => {
        if (
          item.flowKind === 'INCOME' ||
          item.flowKind === 'EXPENSE' ||
          item.flowKind === 'TRANSFER'
        ) {
          items.push({
            id: item.id,
            flowKind: item.flowKind
          });
        }

        return items;
      }, []),
      comparisonPeriod: comparisonPeriod
        ? {
            id: comparisonPeriod.id,
            year: comparisonPeriod.year,
            month: comparisonPeriod.month,
            status: comparisonPeriod.status
          }
        : null,
      comparisonClosingSnapshot: comparisonPeriod
        ? (metricsByPeriodId.get(comparisonPeriod.id)?.closingSnapshot ?? null)
        : null,
      trend: trendPeriods.reduce<DashboardTrendPeriodReadModel[]>(
        (items, period) => {
          const metrics = metricsByPeriodId.get(period.id);
          if (metrics) {
            items.push(metrics);
          }

          return items;
        },
        []
      )
    };
  }
}

async function loadClosingSnapshotMetrics(
  prisma: PrismaService,
  periodId: string
): Promise<DashboardClosingSnapshotRecord | null> {
  const snapshot = await prisma.closingSnapshot.findUnique({
    where: {
      periodId
    },
    include: {
      lines: {
        include: {
          accountSubject: {
            select: {
              subjectKind: true
            }
          },
          fundingAccount: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  if (!snapshot) {
    return null;
  }

  const cashBalanceWon = snapshot.lines
    .filter(
      (line) =>
        line.accountSubject.subjectKind === 'ASSET' &&
        Boolean(line.fundingAccount)
    )
    .map((line) => fromPrismaMoneyWon(line.balanceAmount));

  return {
    totalAssetAmount: fromPrismaMoneyWon(snapshot.totalAssetAmount),
    totalLiabilityAmount: fromPrismaMoneyWon(snapshot.totalLiabilityAmount),
    periodPnLAmount: fromPrismaMoneyWon(snapshot.periodPnLAmount),
    cashBalanceWon: sumMoneyWon(cashBalanceWon)
  };
}

function mapDashboardJournalLineRecord(record: {
  debitAmount: PrismaMoneyLike;
  creditAmount: PrismaMoneyLike;
  accountSubject: DashboardJournalLineRecord['accountSubject'];
}): DashboardJournalLineRecord {
  return {
    ...record,
    debitAmount: fromPrismaMoneyWon(record.debitAmount),
    creditAmount: fromPrismaMoneyWon(record.creditAmount)
  };
}

function mapDashboardPlanItemRecord(record: {
  plannedAmount: PrismaMoneyLike;
  status: DashboardPlanItemRecord['status'];
  ledgerTransactionTypeId: string;
}): DashboardPlanItemRecord {
  return {
    ...record,
    plannedAmount: fromPrismaMoneyWon(record.plannedAmount)
  };
}

function dedupePeriods<T extends { id: string }>(periods: T[]) {
  const seen = new Set<string>();

  return periods.filter((period) => {
    if (seen.has(period.id)) {
      return false;
    }

    seen.add(period.id);
    return true;
  });
}
