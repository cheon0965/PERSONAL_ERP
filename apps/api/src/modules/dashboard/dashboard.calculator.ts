import type { DashboardSummary } from '@personal-erp/contracts';
import type { DashboardSummarySource } from './dashboard.repository';

const DEFAULT_MINIMUM_RESERVE_WON = 400000;
const CURRENT_MONTH = '2026-03';

export function buildDashboardSummary(source: DashboardSummarySource): DashboardSummary {
  const actualBalanceWon = source.accounts.reduce((sum, item) => sum + item.balanceWon, 0);
  const confirmedIncomeWon = source.transactions
    .filter((item) => item.type === 'INCOME')
    .reduce((sum, item) => sum + item.amountWon, 0);
  const confirmedExpenseWon = source.transactions
    .filter((item) => item.type === 'EXPENSE')
    .reduce((sum, item) => sum + item.amountWon, 0);
  const remainingRecurringWon = source.recurringRules.reduce((sum, item) => sum + item.amountWon, 0);
  const insuranceMonthlyWon = source.insurancePolicies.reduce(
    (sum, item) => sum + item.monthlyPremiumWon,
    0
  );
  const vehicleMonthlyWon = source.vehicles.reduce((sum, item) => sum + item.monthlyExpenseWon, 0);
  const expectedMonthEndBalanceWon = actualBalanceWon - remainingRecurringWon;
  const safetySurplusWon =
    expectedMonthEndBalanceWon - (source.minimumReserveWon ?? DEFAULT_MINIMUM_RESERVE_WON);

  return {
    month: CURRENT_MONTH,
    actualBalanceWon,
    confirmedIncomeWon,
    confirmedExpenseWon,
    remainingRecurringWon,
    insuranceMonthlyWon,
    vehicleMonthlyWon,
    expectedMonthEndBalanceWon,
    safetySurplusWon
  };
}
