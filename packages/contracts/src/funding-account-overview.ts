import type {
  AccountingPeriodItem,
  AccountingPeriodStatus
} from './accounting';
import type { MoneyWon } from './money';
import type {
  AccountType,
  FundingAccountBootstrapStatus,
  FundingAccountStatus,
  LedgerTransactionFlowKind
} from './reference-data';
import type {
  CollectedTransactionPostingStatus,
  JournalEntrySourceKind,
  JournalEntryStatus
} from './transactions';

export type FundingAccountOverviewBasis =
  | 'COLLECTED_TRANSACTIONS'
  | 'POSTED_JOURNALS';

export type FundingAccountOverviewAccountItem = {
  id: string;
  name: string;
  type: AccountType;
  status: FundingAccountStatus;
  bootstrapStatus: FundingAccountBootstrapStatus;
  openingBalanceWon: MoneyWon;
  liveBalanceWon: MoneyWon;
  basisClosingBalanceWon: MoneyWon;
  incomeWon: MoneyWon;
  expenseWon: MoneyWon;
  transferInWon: MoneyWon;
  transferOutWon: MoneyWon;
  netFlowWon: MoneyWon;
  remainingPlannedIncomeWon: MoneyWon;
  remainingPlannedExpenseWon: MoneyWon;
  expectedClosingBalanceWon: MoneyWon;
  transactionCount: number;
  pendingTransactionCount: number;
  postedTransactionCount: number;
  lastActivityOn: string | null;
};

export type FundingAccountOverviewTotals = {
  fundingAccountCount: number;
  activeFundingAccountCount: number;
  openingBalanceWon: MoneyWon;
  liveBalanceWon: MoneyWon;
  basisClosingBalanceWon: MoneyWon;
  incomeWon: MoneyWon;
  expenseWon: MoneyWon;
  transferInWon: MoneyWon;
  transferOutWon: MoneyWon;
  netFlowWon: MoneyWon;
  remainingPlannedIncomeWon: MoneyWon;
  remainingPlannedExpenseWon: MoneyWon;
  expectedClosingBalanceWon: MoneyWon;
  transactionCount: number;
  pendingTransactionCount: number;
  postedTransactionCount: number;
};

export type FundingAccountOverviewTrendPoint = {
  periodId: string;
  monthLabel: string;
  periodStatus: AccountingPeriodStatus;
  incomeWon: MoneyWon;
  expenseWon: MoneyWon;
  netFlowWon: MoneyWon;
  closingBalanceWon: MoneyWon | null;
  isOfficial: boolean;
};

export type FundingAccountOverviewCategoryItem = {
  categoryName: string;
  flowKind: Extract<LedgerTransactionFlowKind, 'INCOME' | 'EXPENSE'>;
  amountWon: MoneyWon;
  transactionCount: number;
};

export type FundingAccountOverviewTransactionItem = {
  id: string;
  businessDate: string;
  title: string;
  fundingAccountId: string;
  fundingAccountName: string;
  flowKind: LedgerTransactionFlowKind;
  amountWon: MoneyWon;
  categoryName: string | null;
  status: CollectedTransactionPostingStatus | JournalEntryStatus;
  sourceKind: 'COLLECTED_TRANSACTION' | JournalEntrySourceKind;
  journalEntryId: string | null;
  journalEntryNumber: string | null;
};

export type FundingAccountOverviewResponse = {
  period: AccountingPeriodItem;
  basis: FundingAccountOverviewBasis;
  selectedFundingAccountId: string | null;
  totals: FundingAccountOverviewTotals;
  accounts: FundingAccountOverviewAccountItem[];
  trend: FundingAccountOverviewTrendPoint[];
  categoryBreakdown: FundingAccountOverviewCategoryItem[];
  transactions: FundingAccountOverviewTransactionItem[];
  warnings: string[];
};
