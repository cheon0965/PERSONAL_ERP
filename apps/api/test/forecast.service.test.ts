import assert from 'node:assert/strict';
import test from 'node:test';
import { ForecastService } from '../src/modules/forecast/forecast.service';

test('ForecastService.getMonthlyForecast uses configured reserve and sinking fund values', async () => {
  const repository = {
    getForecastSource: async () => ({
      minimumReserveWon: 450000,
      monthlySinkingFundWon: 120000,
      accounts: [{ balanceWon: 3180000 }],
      transactions: [
        { type: 'INCOME' as const, amountWon: 3200000 },
        { type: 'EXPENSE' as const, amountWon: 1465000 }
      ],
      recurringRules: [{ amountWon: 540000 }]
    })
  };

  const service = new ForecastService(repository as never);
  const result = await service.getMonthlyForecast('user-1', '2026-03');

  assert.deepEqual(result, {
    month: '2026-03',
    actualBalanceWon: 3180000,
    expectedIncomeWon: 0,
    confirmedExpenseWon: 1465000,
    remainingRecurringWon: 540000,
    sinkingFundWon: 120000,
    minimumReserveWon: 450000,
    expectedMonthEndBalanceWon: 2520000,
    safetySurplusWon: 2070000,
    notes: [
      'Recurring income auto-forecast is not included in the MVP baseline yet.',
      'Irregular spending buffer is modeled as a monthly sinking fund.'
    ]
  });
});

test('ForecastService.getMonthlyForecast falls back to default reserve assumptions when settings are missing', async () => {
  const repository = {
    getForecastSource: async () => ({
      minimumReserveWon: null,
      monthlySinkingFundWon: null,
      accounts: [{ balanceWon: 1000000 }],
      transactions: [{ type: 'EXPENSE' as const, amountWon: 500000 }],
      recurringRules: [{ amountWon: 200000 }]
    })
  };

  const service = new ForecastService(repository as never);
  const result = await service.getMonthlyForecast('user-1', '2026-04');

  assert.equal(result.sinkingFundWon, 140000);
  assert.equal(result.minimumReserveWon, 400000);
  assert.equal(result.expectedMonthEndBalanceWon, 660000);
  assert.equal(result.safetySurplusWon, 260000);
});
