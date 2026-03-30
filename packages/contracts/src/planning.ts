import type { AccountingPeriodItem } from './accounting';

export type PlanItemStatus =
  | 'DRAFT'
  | 'MATCHED'
  | 'CONFIRMED'
  | 'SKIPPED'
  | 'EXPIRED';

export type PlanItemItem = {
  id: string;
  periodId: string;
  title: string;
  plannedDate: string;
  plannedAmount: number;
  status: PlanItemStatus;
  recurringRuleId: string | null;
  recurringRuleTitle: string | null;
  ledgerTransactionTypeName: string;
  fundingAccountName: string;
  categoryName: string;
  matchedCollectedTransactionId: string | null;
  postedJournalEntryId: string | null;
};

export type PlanItemSummary = {
  totalCount: number;
  totalPlannedAmount: number;
  draftCount: number;
  matchedCount: number;
  confirmedCount: number;
  skippedCount: number;
  expiredCount: number;
};

export type PlanItemsView = {
  period: AccountingPeriodItem;
  items: PlanItemItem[];
  summary: PlanItemSummary;
};

export type GeneratePlanItemsRequest = {
  periodId: string;
};

export type GeneratePlanItemsResponse = PlanItemsView & {
  generation: {
    createdCount: number;
    skippedExistingCount: number;
    excludedRuleCount: number;
  };
};

export type DashboardSummary = {
  month: string;
  actualBalanceWon: number;
  confirmedIncomeWon: number;
  confirmedExpenseWon: number;
  remainingRecurringWon: number;
  insuranceMonthlyWon: number;
  vehicleMonthlyWon: number;
  expectedMonthEndBalanceWon: number;
  safetySurplusWon: number;
};

export type ForecastResponse = {
  month: string;
  actualBalanceWon: number;
  expectedIncomeWon: number;
  confirmedExpenseWon: number;
  remainingRecurringWon: number;
  sinkingFundWon: number;
  minimumReserveWon: number;
  expectedMonthEndBalanceWon: number;
  safetySurplusWon: number;
  notes: string[];
};
