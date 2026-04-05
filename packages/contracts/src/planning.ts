import type {
  AccountingPeriodItem,
  AccountingPeriodStatus
} from './accounting';
import type { CollectedTransactionPostingStatus } from './transactions';

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
  matchedCollectedTransactionTitle: string | null;
  matchedCollectedTransactionStatus: CollectedTransactionPostingStatus | null;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
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

export type ReportingBasisStatus = 'LIVE_OPERATIONS' | 'OFFICIAL_LOCKED';

export type ReportingHighlightTone = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export type ReportingHighlightItem = {
  label: string;
  amountWon: number;
  tone: ReportingHighlightTone;
};

export type ReportingTrendPoint = {
  periodId: string;
  monthLabel: string;
  periodStatus: AccountingPeriodStatus;
  incomeWon: number;
  expenseWon: number;
  plannedIncomeWon: number;
  plannedExpenseWon: number;
  periodPnLWon: number | null;
  cashWon: number | null;
  netWorthWon: number | null;
  isOfficial: boolean;
};

export type ReportingOfficialComparison = {
  periodId: string;
  monthLabel: string;
  officialCashWon: number;
  officialNetWorthWon: number;
  officialPeriodPnLWon: number;
};

export type DashboardSummary = {
  period: AccountingPeriodItem;
  basisStatus: ReportingBasisStatus;
  actualBalanceWon: number;
  confirmedIncomeWon: number;
  confirmedExpenseWon: number;
  remainingPlannedIncomeWon: number;
  remainingPlannedExpenseWon: number;
  minimumReserveWon: number;
  expectedMonthEndBalanceWon: number;
  safetySurplusWon: number;
  warnings: string[];
  highlights: ReportingHighlightItem[];
  trend: ReportingTrendPoint[];
  officialComparison: ReportingOfficialComparison | null;
};

export type ForecastResponse = {
  period: AccountingPeriodItem;
  basisStatus: ReportingBasisStatus;
  actualBalanceWon: number;
  confirmedIncomeWon: number;
  expectedIncomeWon: number;
  confirmedExpenseWon: number;
  remainingPlannedExpenseWon: number;
  sinkingFundWon: number;
  minimumReserveWon: number;
  expectedMonthEndBalanceWon: number;
  safetySurplusWon: number;
  warnings: string[];
  highlights: ReportingHighlightItem[];
  trend: ReportingTrendPoint[];
  officialComparison: ReportingOfficialComparison | null;
  notes: string[];
};
