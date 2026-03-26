import type { ForecastResponse } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockForecast: ForecastResponse = {
  month: '2026-03',
  actualBalanceWon: 3180000,
  expectedIncomeWon: 0,
  confirmedExpenseWon: 1465000,
  remainingRecurringWon: 540000,
  sinkingFundWon: 140000,
  minimumReserveWon: 400000,
  expectedMonthEndBalanceWon: 2235000,
  safetySurplusWon: 1835000,
  notes: [
    'Variable income is intentionally excluded from the baseline MVP forecast.',
    'Irregular spending buckets are still represented as a simple sinking-fund assumption.'
  ]
};

export function getForecast(month = '2026-03') {
  return fetchJson<ForecastResponse>(`/forecast/monthly?month=${month}`, mockForecast);
}
