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
    '변동 수입은 기준 MVP 전망에서 의도적으로 제외했습니다.',
    '비정기 지출은 단순 적립금 가정으로만 반영하고 있습니다.'
  ]
};

export function getForecast(month = '2026-03') {
  return fetchJson<ForecastResponse>(`/forecast/monthly?month=${month}`, mockForecast);
}
