import { Injectable } from '@nestjs/common';
import type { ReportingBasisStatus } from '@personal-erp/contracts';
import { AccountingPeriodStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  findLatestLockedPeriod,
  selectOperationalPeriod
} from '../reporting/reporting-period-selection';

const forecastPeriodInclude =
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

type ForecastPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof forecastPeriodInclude;
}>;

type ForecastJournalLineRecord = {
  debitAmount: number;
  creditAmount: number;
  accountSubject: {
    subjectKind: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  };
};

type ForecastPlanItemRecord = {
  plannedAmount: number;
  status: 'DRAFT' | 'MATCHED' | 'CONFIRMED' | 'SKIPPED' | 'EXPIRED';
  ledgerTransactionTypeId: string;
};

type ForecastClosingSnapshotRecord = {
  totalAssetAmount: number;
  totalLiabilityAmount: number;
  periodPnLAmount: number;
  cashBalanceWon: number;
};

export type ForecastTrendPeriodReadModel = {
  period: Pick<ForecastPeriodRecord, 'id' | 'year' | 'month' | 'status'>;
  journalLines: ForecastJournalLineRecord[];
  planItems: ForecastPlanItemRecord[];
  closingSnapshot: ForecastClosingSnapshotRecord | null;
};

export type MonthlyForecastReadModel = {
  targetPeriod: ForecastPeriodRecord;
  basisStatus: ReportingBasisStatus;
  minimumReserveWon: number | null;
  monthlySinkingFundWon: number | null;
  currentFundingBalanceWon: number;
  targetJournalLines: ForecastJournalLineRecord[];
  targetPlanItems: ForecastPlanItemRecord[];
  targetClosingSnapshot: ForecastClosingSnapshotRecord | null;
  ledgerTransactionTypes: Array<{
    id: string;
    flowKind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  }>;
  comparisonPeriod: Pick<
    ForecastPeriodRecord,
    'id' | 'year' | 'month' | 'status'
  > | null;
  comparisonClosingSnapshot: ForecastClosingSnapshotRecord | null;
  trend: ForecastTrendPeriodReadModel[];
};

@Injectable()
export class ForecastReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyForecastReadModel(input: {
    userId: string;
    tenantId: string;
    ledgerId: string;
    periodId?: string;
    monthLabel?: string;
  }): Promise<MonthlyForecastReadModel | null> {
    const [user, periods, accounts, ledgerTransactionTypes] = await Promise.all(
      [
        this.prisma.user.findUniqueOrThrow({
          where: { id: input.userId },
          select: {
            settings: {
              select: {
                minimumReserveWon: true,
                monthlySinkingFundWon: true
              }
            }
          }
        }),
        this.prisma.accountingPeriod.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          include: forecastPeriodInclude,
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        }),
        this.prisma.account.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          select: {
            balanceWon: true
          }
        }),
        this.prisma.ledgerTransactionType.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId,
            isActive: true
          }
        })
      ]
    );

    const targetPeriod = selectOperationalPeriod(
      periods,
      input.periodId,
      input.monthLabel
    );
    if (!targetPeriod) {
      return null;
    }

    const comparisonPeriod =
      targetPeriod.status === AccountingPeriodStatus.LOCKED
        ? targetPeriod
        : findLatestLockedPeriod(periods);

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
            journalLines,
            planItems,
            closingSnapshot
          }
        ] as const;
      })
    );

    const metricsByPeriodId = new Map(periodMetrics);
    const currentFundingBalanceWon = accounts.reduce(
      (sum, account) => sum + account.balanceWon,
      0
    );

    return {
      targetPeriod,
      basisStatus:
        targetPeriod.status === AccountingPeriodStatus.LOCKED
          ? 'OFFICIAL_LOCKED'
          : 'LIVE_OPERATIONS',
      minimumReserveWon: user.settings?.minimumReserveWon ?? null,
      monthlySinkingFundWon: user.settings?.monthlySinkingFundWon ?? null,
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
      trend: trendPeriods.reduce<ForecastTrendPeriodReadModel[]>(
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
): Promise<ForecastClosingSnapshotRecord | null> {
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
    .reduce((sum, line) => sum + line.balanceAmount, 0);

  return {
    totalAssetAmount: snapshot.totalAssetAmount,
    totalLiabilityAmount: snapshot.totalLiabilityAmount,
    periodPnLAmount: snapshot.periodPnLAmount,
    cashBalanceWon
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
