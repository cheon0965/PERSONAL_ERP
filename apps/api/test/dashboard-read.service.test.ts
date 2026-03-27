import assert from 'node:assert/strict';
import test from 'node:test';
import { DashboardReadService } from '../src/modules/dashboard/dashboard-read.service';

test('DashboardReadService.getSummary aggregates read-model data into the dashboard projection', async () => {
  const repository = {
    getDashboardSummaryReadModel: async () => ({
      minimumReserveWon: 500000,
      accounts: [{ balanceWon: 1000000 }, { balanceWon: 200000 }],
      transactions: [
        { type: 'INCOME' as const, amountWon: 3200000 },
        { type: 'EXPENSE' as const, amountWon: 1465000 },
        { type: 'TRANSFER' as const, amountWon: 990000 }
      ],
      recurringRules: [{ amountWon: 540000 }],
      insurancePolicies: [{ monthlyPremiumWon: 198000 }],
      vehicles: [{ monthlyExpenseWon: 286000 }]
    })
  };

  const service = new DashboardReadService(repository as never);
  const result = await service.getSummary('user-1');

  assert.deepEqual(result, {
    month: '2026-03',
    actualBalanceWon: 1200000,
    confirmedIncomeWon: 3200000,
    confirmedExpenseWon: 1465000,
    remainingRecurringWon: 540000,
    insuranceMonthlyWon: 198000,
    vehicleMonthlyWon: 286000,
    expectedMonthEndBalanceWon: 660000,
    safetySurplusWon: 160000
  });
});
