import type { DashboardSummary } from '@personal-erp/contracts';
import type { DashboardSummaryReadModel } from './dashboard-read.repository';

const DEFAULT_MINIMUM_RESERVE_WON = 400000;
const CURRENT_MONTH = '2026-03';

export function projectDashboardSummary(
  readModel: DashboardSummaryReadModel
): DashboardSummary {
  const actualBalanceWon = readModel.accounts.reduce((sum, item) => sum + item.balanceWon, 0);
  const confirmedIncomeWon = readModel.transactions
    .filter((item) => item.type === 'INCOME')
    .reduce((sum, item) => sum + item.amountWon, 0);
  const confirmedExpenseWon = readModel.transactions
    .filter((item) => item.type === 'EXPENSE')
    .reduce((sum, item) => sum + item.amountWon, 0);
  const remainingRecurringWon = readModel.recurringRules.reduce(
    (sum, item) => sum + item.amountWon,
    0
  );
  const insuranceMonthlyWon = readModel.insurancePolicies.reduce(
    (sum, item) => sum + item.monthlyPremiumWon,
    0
  );
  const vehicleMonthlyWon = readModel.vehicles.reduce(
    (sum, item) => sum + item.monthlyExpenseWon,
    0
  );
  const expectedMonthEndBalanceWon = actualBalanceWon - remainingRecurringWon;
  const safetySurplusWon =
    expectedMonthEndBalanceWon -
    (readModel.minimumReserveWon ?? DEFAULT_MINIMUM_RESERVE_WON);

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
