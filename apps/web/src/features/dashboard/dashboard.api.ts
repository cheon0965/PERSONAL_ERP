import type { DashboardSummary } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockDashboardSummary: DashboardSummary = {
  month: '2026-03',
  actualBalanceWon: 3180000,
  confirmedIncomeWon: 3200000,
  confirmedExpenseWon: 1465000,
  remainingRecurringWon: 540000,
  insuranceMonthlyWon: 198000,
  vehicleMonthlyWon: 286000,
  expectedMonthEndBalanceWon: 2235000,
  safetySurplusWon: 1835000
};

export function getDashboardSummary() {
  return fetchJson<DashboardSummary>('/dashboard/summary', mockDashboardSummary);
}
