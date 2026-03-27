import type { ForecastResponse } from '@personal-erp/contracts';
import type { MonthlyForecastReadModel } from './forecast-read.repository';

const DEFAULT_MINIMUM_RESERVE_WON = 400000;
const DEFAULT_MONTHLY_SINKING_FUND_WON = 140000;

export function projectMonthlyForecast(
  month: string,
  readModel: MonthlyForecastReadModel
): ForecastResponse {
  const actualBalanceWon = readModel.accounts.reduce((sum, item) => sum + item.balanceWon, 0);
  const confirmedExpenseWon = readModel.transactions
    .filter((item) => item.type === 'EXPENSE')
    .reduce((sum, item) => sum + item.amountWon, 0);
  const expectedIncomeWon = 0;
  const remainingRecurringWon = readModel.recurringRules.reduce(
    (sum, item) => sum + item.amountWon,
    0
  );
  const sinkingFundWon =
    readModel.monthlySinkingFundWon ?? DEFAULT_MONTHLY_SINKING_FUND_WON;
  const minimumReserveWon =
    readModel.minimumReserveWon ?? DEFAULT_MINIMUM_RESERVE_WON;
  const expectedMonthEndBalanceWon =
    actualBalanceWon + expectedIncomeWon - remainingRecurringWon - sinkingFundWon;
  const safetySurplusWon = expectedMonthEndBalanceWon - minimumReserveWon;

  return {
    month,
    actualBalanceWon,
    expectedIncomeWon,
    confirmedExpenseWon,
    remainingRecurringWon,
    sinkingFundWon,
    minimumReserveWon,
    expectedMonthEndBalanceWon,
    safetySurplusWon,
    notes: [
      'Recurring income auto-forecast is not included in the MVP baseline yet.',
      'Irregular spending buffer is modeled as a monthly sinking fund.'
    ]
  };
}
