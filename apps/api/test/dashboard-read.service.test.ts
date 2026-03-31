import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountingPeriodStatus } from '@prisma/client';
import { DashboardReadService } from '../src/modules/dashboard/dashboard-read.service';

test('DashboardReadService.getSummary projects a workspace-period operational summary', async () => {
  const repository = {
    getDashboardSummaryReadModel: async () => ({
      targetPeriod: buildPeriod(
        'period-2026-03',
        2026,
        3,
        AccountingPeriodStatus.OPEN
      ),
      basisStatus: 'LIVE_OPERATIONS' as const,
      minimumReserveWon: 450_000,
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
          plannedAmount: 540_000,
          status: 'DRAFT' as const,
          ledgerTransactionTypeId: 'ltt-expense'
        }
      ],
      targetClosingSnapshot: null,
      ledgerTransactionTypes: [
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
              plannedAmount: 540_000,
              status: 'DRAFT' as const,
              ledgerTransactionTypeId: 'ltt-expense'
            }
          ],
          closingSnapshot: null
        }
      ]
    })
  };

  const service = new DashboardReadService(repository as never);
  const result = await service.getSummary(buildUser(), 'period-2026-03');

  assert.ok(result);
  assert.equal(result.period.monthLabel, '2026-03');
  assert.equal(result.basisStatus, 'LIVE_OPERATIONS');
  assert.equal(result.actualBalanceWon, 3_180_000);
  assert.equal(result.confirmedIncomeWon, 3_200_000);
  assert.equal(result.confirmedExpenseWon, 1_465_000);
  assert.equal(result.remainingPlannedExpenseWon, 540_000);
  assert.equal(result.expectedMonthEndBalanceWon, 2_640_000);
  assert.equal(result.safetySurplusWon, 2_190_000);
  assert.equal(result.officialComparison?.monthLabel, '2026-02');
  assert.equal(result.trend.length, 2);
});

test('DashboardReadService.getSummary returns null when no operational period exists', async () => {
  const repository = {
    getDashboardSummaryReadModel: async () => null
  };

  const service = new DashboardReadService(repository as never);
  const result = await service.getSummary(buildUser());

  assert.equal(result, null);
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
        name: '개인 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE' as const
      }
    }
  };
}
