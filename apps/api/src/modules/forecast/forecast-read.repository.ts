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
  selectOperationalPeriod
} from '../reporting/reporting-period-selection';
import { summarizeJournalLines } from '../reporting/reporting-metrics';

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

export type ForecastCategoryJournalLineRecord = ForecastJournalLineRecord & {
  categoryName: string | null;
};

export type ForecastCategoryPlanItemRecord = ForecastPlanItemRecord & {
  categoryName: string | null;
};

export type ForecastRecurringRuleRecord = {
  id: string;
  title: string;
  amountWon: number;
  flowKind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  frequency: string;
};

export type ForecastInsurancePolicyRecord = {
  id: string;
  provider: string;
  productName: string;
  monthlyPremiumWon: number;
};

export type ForecastDebtRepaymentRecord = {
  id: string;
  lenderName: string;
  totalAmount: number;
  dueDate: Date;
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
  targetCategoryJournalLines: ForecastCategoryJournalLineRecord[];
  targetCategoryPlanItems: ForecastCategoryPlanItemRecord[];
  activeRecurringRules: ForecastRecurringRuleRecord[];
  activeInsurancePolicies: ForecastInsurancePolicyRecord[];
  nextMonthDebtRepayments: ForecastDebtRepaymentRecord[];
  nextPeriod: Pick<
    ForecastPeriodRecord,
    'id' | 'year' | 'month' | 'status'
  > | null;
  nextPeriodPlanItems: ForecastPlanItemRecord[];
  previousPeriodMetrics: {
    incomeWon: number;
    expenseWon: number;
    balanceWon: number | null;
  } | null;
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
    const [user, periods, currentFundingBalanceWon, ledgerTransactionTypes] =
      await Promise.all([
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
            journalLines: journalLines.map(mapForecastJournalLineRecord),
            planItems: planItems.map(mapForecastPlanItemRecord),
            closingSnapshot
          }
        ] as const;
      })
    );

    const nextYear =
      targetPeriod.month === 12 ? targetPeriod.year + 1 : targetPeriod.year;
    const nextMonth = targetPeriod.month === 12 ? 1 : targetPeriod.month + 1;

    const prevPeriodRecord = periods.find((period) =>
      targetPeriod.month === 1
        ? period.year === targetPeriod.year - 1 && period.month === 12
        : period.year === targetPeriod.year &&
          period.month === targetPeriod.month - 1
    );

    const [
      categoryJournalLines,
      categoryPlanItems,
      recurringRules,
      insurancePolicies,
      debtRepayments,
      nextPeriodRecord,
      nextPeriodPlanItemsRaw
    ] = await Promise.all([
      this.prisma.journalLine.findMany({
        where: {
          journalEntry: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId,
            periodId: targetPeriod.id,
            status: 'POSTED'
          }
        },
        include: {
          accountSubject: { select: { subjectKind: true } },
          journalEntry: {
            select: {
              sourceCollectedTransaction: {
                select: { category: { select: { name: true } } }
              }
            }
          }
        }
      }),
      this.prisma.planItem.findMany({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          periodId: targetPeriod.id
        },
        include: { category: { select: { name: true } } }
      }),
      this.prisma.recurringRule.findMany({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          isActive: true,
          startDate: {
            lte: new Date(
              `${nextYear}-${String(nextMonth).padStart(2, '0')}-28T23:59:59.999Z`
            )
          },
          OR: [
            { endDate: null },
            {
              endDate: {
                gte: new Date(
                  `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`
                )
              }
            }
          ]
        },
        include: { ledgerTransactionType: { select: { flowKind: true } } }
      }),
      this.prisma.insurancePolicy.findMany({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          isActive: true,
          monthlyPremiumWon: { gt: 0 }
        }
      }),
      this.prisma.liabilityRepaymentSchedule.findMany({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          dueDate: {
            gte: new Date(
              `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`
            ),
            lt: new Date(
              nextMonth === 12
                ? `${nextYear + 1}-01-01T00:00:00.000Z`
                : `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01T00:00:00.000Z`
            )
          },
          status: { in: ['SCHEDULED', 'PLANNED'] }
        },
        include: { agreement: { select: { lenderName: true } } }
      }),
      this.prisma.accountingPeriod.findFirst({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          year: nextYear,
          month: nextMonth
        }
      }),
      this.prisma.planItem.findMany({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          period: { year: nextYear, month: nextMonth }
        }
      })
    ]);

    const metricsByPeriodId = new Map(periodMetrics);

    const prevMetrics = prevPeriodRecord
      ? metricsByPeriodId.get(prevPeriodRecord.id)
      : null;
    let previousPeriodMetrics: MonthlyForecastReadModel['previousPeriodMetrics'] =
      null;
    if (prevMetrics) {
      const prevSummary = summarizeJournalLines(prevMetrics.journalLines);
      previousPeriodMetrics = {
        incomeWon: prevSummary.incomeWon,
        expenseWon: prevSummary.expenseWon,
        balanceWon: prevMetrics.closingSnapshot?.cashBalanceWon ?? null
      };
    }

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
      monthlySinkingFundWon:
        user.settings?.monthlySinkingFundWon == null
          ? null
          : fromPrismaMoneyWon(user.settings.monthlySinkingFundWon),
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
      ),
      targetCategoryJournalLines: categoryJournalLines.map((line) => ({
        ...mapForecastJournalLineRecord(line),
        categoryName:
          line.journalEntry?.sourceCollectedTransaction?.category?.name ?? null
      })),
      targetCategoryPlanItems: categoryPlanItems.map((item) => ({
        ...mapForecastPlanItemRecord(item),
        categoryName: item.category?.name ?? null
      })),
      activeRecurringRules: recurringRules.map((rule) => ({
        id: rule.id,
        title: rule.title,
        amountWon: fromPrismaMoneyWon(rule.amountWon),
        flowKind: (rule.ledgerTransactionType?.flowKind ?? 'EXPENSE') as
          | 'INCOME'
          | 'EXPENSE'
          | 'TRANSFER',
        frequency: rule.frequency
      })),
      activeInsurancePolicies: insurancePolicies.map((policy) => ({
        id: policy.id,
        provider: policy.provider,
        productName: policy.productName,
        monthlyPremiumWon: fromPrismaMoneyWon(policy.monthlyPremiumWon)
      })),
      nextMonthDebtRepayments: debtRepayments.map((repayment) => ({
        id: repayment.id,
        lenderName: repayment.agreement.lenderName,
        totalAmount: fromPrismaMoneyWon(repayment.totalAmount),
        dueDate: repayment.dueDate
      })),
      nextPeriod: nextPeriodRecord
        ? {
            id: nextPeriodRecord.id,
            year: nextPeriodRecord.year,
            month: nextPeriodRecord.month,
            status: nextPeriodRecord.status
          }
        : null,
      nextPeriodPlanItems: nextPeriodPlanItemsRaw.map(
        mapForecastPlanItemRecord
      ),
      previousPeriodMetrics
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
    .map((line) => fromPrismaMoneyWon(line.balanceAmount));

  return {
    totalAssetAmount: fromPrismaMoneyWon(snapshot.totalAssetAmount),
    totalLiabilityAmount: fromPrismaMoneyWon(snapshot.totalLiabilityAmount),
    periodPnLAmount: fromPrismaMoneyWon(snapshot.periodPnLAmount),
    cashBalanceWon: sumMoneyWon(cashBalanceWon)
  };
}

function mapForecastJournalLineRecord(record: {
  debitAmount: PrismaMoneyLike;
  creditAmount: PrismaMoneyLike;
  accountSubject: ForecastJournalLineRecord['accountSubject'];
}): ForecastJournalLineRecord {
  return {
    ...record,
    debitAmount: fromPrismaMoneyWon(record.debitAmount),
    creditAmount: fromPrismaMoneyWon(record.creditAmount)
  };
}

function mapForecastPlanItemRecord(record: {
  plannedAmount: PrismaMoneyLike;
  status: ForecastPlanItemRecord['status'];
  ledgerTransactionTypeId: string;
}): ForecastPlanItemRecord {
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
