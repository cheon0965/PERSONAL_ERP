import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from './request-api.test-support';
test('GET /dashboard/summary returns only aggregated data for the authenticated user', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/dashboard/summary', {
      headers: context.authHeaders()
    });

    const summary = response.body as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.deepEqual(summary, {
      month: '2026-03',
      actualBalanceWon: 5_500_000,
      confirmedIncomeWon: 3_000_000,
      confirmedExpenseWon: 84_000,
      remainingRecurringWon: 75_000,
      insuranceMonthlyWon: 42_000,
      vehicleMonthlyWon: 130_000,
      expectedMonthEndBalanceWon: 5_425_000,
      safetySurplusWon: 4_925_000
    });
    assert.equal('accounts' in summary, false);
    assert.equal('transactions' in summary, false);
    assert.equal('recurringRules' in summary, false);
    assert.equal('minimumReserveWon' in summary, false);
  } finally {
    await context.close();
  }
});

test('GET /forecast/monthly returns only aggregated forecast data for the authenticated user and respects the month query', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/forecast/monthly?month=2026-04', {
      headers: context.authHeaders()
    });

    const forecast = response.body as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.deepEqual(forecast, {
      month: '2026-04',
      actualBalanceWon: 5_500_000,
      expectedIncomeWon: 0,
      confirmedExpenseWon: 84_000,
      remainingRecurringWon: 75_000,
      sinkingFundWon: 210_000,
      minimumReserveWon: 500_000,
      expectedMonthEndBalanceWon: 5_215_000,
      safetySurplusWon: 4_715_000,
      notes: [
        'Recurring income auto-forecast is not included in the MVP baseline yet.',
        'Irregular spending buffer is modeled as a monthly sinking fund.'
      ]
    });
    assert.equal('accounts' in forecast, false);
    assert.equal('transactions' in forecast, false);
    assert.equal('recurringRules' in forecast, false);
  } finally {
    await context.close();
  }
});
