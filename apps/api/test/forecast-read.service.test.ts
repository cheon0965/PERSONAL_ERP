import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountingPeriodStatus } from '@prisma/client';
import { ForecastReadService } from '../src/modules/forecast/forecast-read.service';

const defaultNewFields = {
  targetCategoryJournalLines: [],
  targetCategoryPlanItems: [],
  activeRecurringRules: [],
  activeInsurancePolicies: [],
  nextMonthDebtRepayments: [],
  nextPeriod: null,
  nextPeriodPlanItems: [],
  previousPeriodMetrics: null
};

test('ForecastReadService.getMonthlyForecast combines confirmed journals, remaining plans, and reserve assumptions', async () => {
  const repository = {
    getMonthlyForecastReadModel: async () => ({
      targetPeriod: buildPeriod(
        'period-2026-03',
        2026,
        3,
        AccountingPeriodStatus.OPEN
      ),
      basisStatus: 'LIVE_OPERATIONS' as const,
      minimumReserveWon: 450_000,
      monthlySinkingFundWon: 120_000,
      currentFundingBalanceWon: 3_180_000,
      targetJournalLines: [
        {
          debitAmount: 0,
          creditAmount: 3_200_000,
          accountSubject: { subjectKind: 'INCOME' as const }
        },
        {
          debitAmount: 1_465_000,
          creditAmount: 0,
          accountSubject: { subjectKind: 'EXPENSE' as const }
        }
      ],
      targetPlanItems: [
        {
          plannedAmount: 200_000,
          status: 'DRAFT' as const,
          ledgerTransactionTypeId: 'ltt-income'
        },
        {
          plannedAmount: 540_000,
          status: 'MATCHED' as const,
          ledgerTransactionTypeId: 'ltt-expense'
        }
      ],
      targetClosingSnapshot: null,
      ledgerTransactionTypes: [
        { id: 'ltt-income', flowKind: 'INCOME' as const },
        { id: 'ltt-expense', flowKind: 'EXPENSE' as const }
      ],
      comparisonPeriod: {
        id: 'period-2026-02',
        year: 2026,
        month: 2,
        status: AccountingPeriodStatus.LOCKED
      },
      comparisonClosingSnapshot: {
        totalAssetAmount: 2_830_000,
        totalLiabilityAmount: 0,
        periodPnLAmount: 1_670_000,
        cashBalanceWon: 2_830_000
      },
      trend: [
        {
          period: {
            id: 'period-2026-02',
            year: 2026,
            month: 2,
            status: AccountingPeriodStatus.LOCKED
          },
          journalLines: [
            {
              debitAmount: 0,
              creditAmount: 3_180_000,
              accountSubject: { subjectKind: 'INCOME' as const }
            },
            {
              debitAmount: 1_510_000,
              creditAmount: 0,
              accountSubject: { subjectKind: 'EXPENSE' as const }
            }
          ],
          planItems: [],
          closingSnapshot: {
            totalAssetAmount: 2_830_000,
            totalLiabilityAmount: 0,
            periodPnLAmount: 1_670_000,
            cashBalanceWon: 2_830_000
          }
        },
        {
          period: {
            id: 'period-2026-03',
            year: 2026,
            month: 3,
            status: AccountingPeriodStatus.OPEN
          },
          journalLines: [
            {
              debitAmount: 0,
              creditAmount: 3_200_000,
              accountSubject: { subjectKind: 'INCOME' as const }
            },
            {
              debitAmount: 1_465_000,
              creditAmount: 0,
              accountSubject: { subjectKind: 'EXPENSE' as const }
            }
          ],
          planItems: [
            {
              plannedAmount: 200_000,
              status: 'DRAFT' as const,
              ledgerTransactionTypeId: 'ltt-income'
            },
            {
              plannedAmount: 540_000,
              status: 'MATCHED' as const,
              ledgerTransactionTypeId: 'ltt-expense'
            }
          ],
          closingSnapshot: null
        }
      ],
      ...defaultNewFields
    })
  };

  const service = new ForecastReadService(repository as never);
  const result = await service.getMonthlyForecast({
    user: buildUser(),
    periodId: 'period-2026-03'
  });

  assert.ok(result);
  assert.equal(result.period.monthLabel, '2026-03');
  assert.equal(result.expectedIncomeWon, 200_000);
  assert.equal(result.remainingPlannedExpenseWon, 540_000);
  assert.equal(result.sinkingFundWon, 120_000);
  assert.equal(result.expectedMonthEndBalanceWon, 2_720_000);
  assert.equal(result.safetySurplusWon, 2_270_000);
  assert.equal(result.officialComparison?.monthLabel, '2026-02');
  assert.deepEqual(result.categoryDrivers, []);
  assert.equal(result.periodComparison, null);
  assert.equal(result.nextMonthProjection, null);
});

test('ForecastReadService.getMonthlyForecast falls back to default reserve assumptions when settings are missing', async () => {
  const repository = {
    getMonthlyForecastReadModel: async () => ({
      targetPeriod: buildPeriod(
        'period-2026-04',
        2026,
        4,
        AccountingPeriodStatus.OPEN
      ),
      basisStatus: 'LIVE_OPERATIONS' as const,
      minimumReserveWon: null,
      monthlySinkingFundWon: null,
      currentFundingBalanceWon: 1_000_000,
      targetJournalLines: [
        {
          debitAmount: 500_000,
          creditAmount: 0,
          accountSubject: { subjectKind: 'EXPENSE' as const }
        }
      ],
      targetPlanItems: [
        {
          plannedAmount: 200_000,
          status: 'DRAFT' as const,
          ledgerTransactionTypeId: 'ltt-expense'
        }
      ],
      targetClosingSnapshot: null,
      ledgerTransactionTypes: [
        { id: 'ltt-expense', flowKind: 'EXPENSE' as const }
      ],
      comparisonPeriod: null,
      comparisonClosingSnapshot: null,
      trend: [],
      ...defaultNewFields
    })
  };

  const service = new ForecastReadService(repository as never);
  const result = await service.getMonthlyForecast({
    user: buildUser(),
    periodId: 'period-2026-04'
  });

  assert.ok(result);
  assert.equal(result.sinkingFundWon, 140_000);
  assert.equal(result.minimumReserveWon, 400_000);
  assert.equal(result.expectedMonthEndBalanceWon, 660_000);
  assert.equal(result.safetySurplusWon, 260_000);
});

test('next month projection uses recurring rules when no plan items exist', async () => {
  const repository = {
    getMonthlyForecastReadModel: async () => ({
      targetPeriod: buildPeriod(
        'period-2026-03',
        2026,
        3,
        AccountingPeriodStatus.OPEN
      ),
      basisStatus: 'LIVE_OPERATIONS' as const,
      minimumReserveWon: 400_000,
      monthlySinkingFundWon: 140_000,
      currentFundingBalanceWon: 2_000_000,
      targetJournalLines: [],
      targetPlanItems: [],
      targetClosingSnapshot: null,
      ledgerTransactionTypes: [
        { id: 'ltt-income', flowKind: 'INCOME' as const },
        { id: 'ltt-expense', flowKind: 'EXPENSE' as const }
      ],
      comparisonPeriod: null,
      comparisonClosingSnapshot: null,
      trend: [],
      targetCategoryJournalLines: [],
      targetCategoryPlanItems: [],
      activeRecurringRules: [
        {
          id: 'rr-1',
          title: '급여',
          amountWon: 3_000_000,
          flowKind: 'INCOME' as const,
          frequency: 'MONTHLY'
        },
        {
          id: 'rr-2',
          title: '월세',
          amountWon: 500_000,
          flowKind: 'EXPENSE' as const,
          frequency: 'MONTHLY'
        }
      ],
      activeInsurancePolicies: [
        {
          id: 'ip-1',
          provider: '삼성화재',
          productName: '자동차보험',
          monthlyPremiumWon: 85_000
        }
      ],
      nextMonthDebtRepayments: [
        {
          id: 'dr-1',
          lenderName: '국민은행',
          totalAmount: 200_000,
          dueDate: new Date('2026-04-15')
        }
      ],
      nextPeriod: null,
      nextPeriodPlanItems: [],
      previousPeriodMetrics: null
    })
  };

  const service = new ForecastReadService(repository as never);
  const result = await service.getMonthlyForecast({
    user: buildUser(),
    periodId: 'period-2026-03'
  });

  assert.ok(result);
  assert.ok(result.nextMonthProjection);
  assert.equal(result.nextMonthProjection.monthLabel, '2026-04');
  assert.equal(result.nextMonthProjection.isOpen, false);
  assert.equal(result.nextMonthProjection.hasPlanItems, false);
  assert.equal(result.nextMonthProjection.estimatedIncomeWon, 3_000_000);
  assert.equal(result.nextMonthProjection.estimatedExpenseWon, 785_000);
  assert.equal(result.nextMonthProjection.estimatedFixedCosts.length, 4);
  assert.ok(
    result.nextMonthProjection.basisDescription.includes('반복 규칙 2건')
  );
  assert.ok(result.nextMonthProjection.basisDescription.includes('보험 1건'));
  assert.ok(
    result.nextMonthProjection.basisDescription.includes('부채 상환 1건')
  );
});

test('period comparison calculates MoM changes correctly', async () => {
  const repository = {
    getMonthlyForecastReadModel: async () => ({
      targetPeriod: buildPeriod(
        'period-2026-03',
        2026,
        3,
        AccountingPeriodStatus.OPEN
      ),
      basisStatus: 'LIVE_OPERATIONS' as const,
      minimumReserveWon: 400_000,
      monthlySinkingFundWon: 140_000,
      currentFundingBalanceWon: 3_000_000,
      targetJournalLines: [
        {
          debitAmount: 0,
          creditAmount: 3_200_000,
          accountSubject: { subjectKind: 'INCOME' as const }
        },
        {
          debitAmount: 1_500_000,
          creditAmount: 0,
          accountSubject: { subjectKind: 'EXPENSE' as const }
        }
      ],
      targetPlanItems: [],
      targetClosingSnapshot: null,
      ledgerTransactionTypes: [],
      comparisonPeriod: null,
      comparisonClosingSnapshot: null,
      trend: [],
      targetCategoryJournalLines: [],
      targetCategoryPlanItems: [],
      activeRecurringRules: [],
      activeInsurancePolicies: [],
      nextMonthDebtRepayments: [],
      nextPeriod: null,
      nextPeriodPlanItems: [],
      previousPeriodMetrics: {
        incomeWon: 3_000_000,
        expenseWon: 1_400_000,
        balanceWon: 2_700_000
      }
    })
  };

  const service = new ForecastReadService(repository as never);
  const result = await service.getMonthlyForecast({
    user: buildUser(),
    periodId: 'period-2026-03'
  });

  assert.ok(result);
  assert.ok(result.periodComparison);
  assert.equal(result.periodComparison.previousMonthLabel, '2026-02');
  assert.equal(result.periodComparison.incomeChangeWon, 200_000);
  assert.equal(result.periodComparison.expenseChangeWon, 100_000);
  assert.equal(result.periodComparison.balanceChangeWon, 300_000);
});

function buildPeriod(
  id: string,
  year: number,
  month: number,
  status: AccountingPeriodStatus
) {
  return {
    id,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    year,
    month,
    startDate: new Date(
      `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`
    ),
    endDate: new Date(
      `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00.000Z`
    ),
    status,
    openedAt: new Date(
      `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`
    ),
    lockedAt: status === AccountingPeriodStatus.LOCKED ? new Date() : null,
    openingBalanceSnapshot: {
      sourceKind: 'CARRY_FORWARD' as const
    },
    statusHistory: []
  };
}

function buildUser() {
  return {
    id: 'user-1',
    email: 'demo@example.com',
    name: 'Demo User',
    currentWorkspace: {
      tenant: {
        id: 'tenant-1',
        slug: 'demo-tenant',
        name: 'Demo Workspace',
        status: 'ACTIVE' as const
      },
      membership: {
        id: 'membership-1',
        role: 'OWNER' as const,
        status: 'ACTIVE' as const
      },
      ledger: {
        id: 'ledger-1',
        name: '사업 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE' as const
      }
    }
  };
}
