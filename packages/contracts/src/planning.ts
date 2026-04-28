import type {
  AccountingPeriodItem,
  AccountingPeriodStatus
} from './accounting';
import type { MoneyWon } from './money';
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
  plannedAmount: MoneyWon;
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
  totalPlannedAmount: MoneyWon;
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
  amountWon: MoneyWon;
  tone: ReportingHighlightTone;
};

export type ReportingTrendPoint = {
  periodId: string;
  monthLabel: string;
  periodStatus: AccountingPeriodStatus;
  incomeWon: MoneyWon;
  expenseWon: MoneyWon;
  plannedIncomeWon: MoneyWon;
  plannedExpenseWon: MoneyWon;
  periodPnLWon: MoneyWon | null;
  cashWon: MoneyWon | null;
  netWorthWon: MoneyWon | null;
  isOfficial: boolean;
};

export type ReportingOfficialComparison = {
  periodId: string;
  monthLabel: string;
  officialCashWon: MoneyWon;
  officialNetWorthWon: MoneyWon;
  officialPeriodPnLWon: MoneyWon;
};

export type DashboardSummary = {
  period: AccountingPeriodItem;
  basisStatus: ReportingBasisStatus;
  actualBalanceWon: MoneyWon;
  confirmedIncomeWon: MoneyWon;
  confirmedExpenseWon: MoneyWon;
  remainingPlannedIncomeWon: MoneyWon;
  remainingPlannedExpenseWon: MoneyWon;
  minimumReserveWon: MoneyWon;
  expectedMonthEndBalanceWon: MoneyWon;
  safetySurplusWon: MoneyWon;
  warnings: string[];
  highlights: ReportingHighlightItem[];
  trend: ReportingTrendPoint[];
  officialComparison: ReportingOfficialComparison | null;
};

export type ForecastResponse = {
  period: AccountingPeriodItem;
  basisStatus: ReportingBasisStatus;
  actualBalanceWon: MoneyWon;
  confirmedIncomeWon: MoneyWon;
  expectedIncomeWon: MoneyWon;
  confirmedExpenseWon: MoneyWon;
  remainingPlannedExpenseWon: MoneyWon;
  sinkingFundWon: MoneyWon;
  minimumReserveWon: MoneyWon;
  expectedMonthEndBalanceWon: MoneyWon;
  safetySurplusWon: MoneyWon;
  warnings: string[];
  highlights: ReportingHighlightItem[];
  trend: ReportingTrendPoint[];
  officialComparison: ReportingOfficialComparison | null;
  notes: string[];
  categoryDrivers: ForecastCategoryDriver[];
  periodComparison: ForecastPeriodComparison | null;
  nextMonthProjection: ForecastNextMonthProjection | null;
};

export type ForecastCategoryDriver = {
  categoryName: string;
  confirmedWon: MoneyWon;
  remainingPlannedWon: MoneyWon;
  flowKind: 'INCOME' | 'EXPENSE';
};

export type ForecastPeriodComparison = {
  previousMonthLabel: string;
  incomeChangeWon: MoneyWon;
  expenseChangeWon: MoneyWon;
  balanceChangeWon: MoneyWon;
  incomeChangePercent: number | null;
  expenseChangePercent: number | null;
};

export type ForecastFixedCostItem = {
  label: string;
  amountWon: MoneyWon;
  source: 'RECURRING_RULE' | 'INSURANCE' | 'LIABILITY';
};

export type ForecastNextMonthProjection = {
  monthLabel: string;
  isOpen: boolean;
  hasPlanItems: boolean;
  estimatedIncomeWon: MoneyWon;
  estimatedExpenseWon: MoneyWon;
  estimatedFixedCosts: ForecastFixedCostItem[];
  projectedBalanceWon: MoneyWon;
  basisDescription: string;
};
