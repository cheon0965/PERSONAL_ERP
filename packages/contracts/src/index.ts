export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  currentWorkspace: AuthenticatedWorkspace | null;
};

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type TenantMembershipRole = 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
export type TenantMembershipStatus =
  | 'INVITED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REMOVED';
export type LedgerStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type AuthenticatedWorkspace = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
  };
  membership: {
    id: string;
    role: TenantMembershipRole;
    status: TenantMembershipStatus;
  };
  ledger: {
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
    status: LedgerStatus;
  } | null;
};

export type AccountingPeriodStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'CLOSING'
  | 'LOCKED';
export type AuditActorType = 'TENANT_MEMBERSHIP' | 'SYSTEM';
export type OpeningBalanceSourceKind = 'INITIAL_SETUP' | 'CARRY_FORWARD';

export type PeriodStatusHistoryItem = {
  id: string;
  fromStatus: AccountingPeriodStatus | null;
  toStatus: AccountingPeriodStatus;
  reason: string | null;
  actorType: AuditActorType;
  actorMembershipId: string | null;
  changedAt: string;
};

export type AccountingPeriodItem = {
  id: string;
  year: number;
  month: number;
  monthLabel: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
  openedAt: string;
  lockedAt: string | null;
  hasOpeningBalanceSnapshot: boolean;
  openingBalanceSourceKind: OpeningBalanceSourceKind | null;
  statusHistory: PeriodStatusHistoryItem[];
};

export type OpenAccountingPeriodRequest = {
  month: string;
  initializeOpeningBalance?: boolean;
  note?: string;
};

export type CloseAccountingPeriodRequest = {
  note?: string;
};

export type ClosingSnapshotLineItem = {
  id: string;
  accountSubjectCode: string;
  accountSubjectName: string;
  fundingAccountName: string | null;
  balanceAmount: number;
};

export type ClosingSnapshotItem = {
  id: string;
  periodId: string;
  lockedAt: string;
  totalAssetAmount: number;
  totalLiabilityAmount: number;
  totalEquityAmount: number;
  periodPnLAmount: number;
  lines: ClosingSnapshotLineItem[];
};

export type CloseAccountingPeriodResponse = {
  period: AccountingPeriodItem;
  closingSnapshot: ClosingSnapshotItem;
};

export type OpeningBalanceSnapshotLineItem = {
  id: string;
  accountSubjectCode: string;
  accountSubjectName: string;
  fundingAccountName: string | null;
  balanceAmount: number;
};

export type OpeningBalanceSnapshotItem = {
  id: string;
  effectivePeriodId: string;
  sourceKind: OpeningBalanceSourceKind;
  createdAt: string;
  lines: OpeningBalanceSnapshotLineItem[];
};

export type CarryForwardRecordItem = {
  id: string;
  fromPeriodId: string;
  toPeriodId: string;
  sourceClosingSnapshotId: string;
  createdJournalEntryId: string | null;
  createdAt: string;
  createdByActorType: AuditActorType;
  createdByMembershipId: string | null;
};

export type GenerateCarryForwardRequest = {
  fromPeriodId: string;
};

export type CarryForwardView = {
  carryForwardRecord: CarryForwardRecordItem;
  sourcePeriod: AccountingPeriodItem;
  sourceClosingSnapshot: ClosingSnapshotItem;
  targetPeriod: AccountingPeriodItem;
  targetOpeningBalanceSnapshot: OpeningBalanceSnapshotItem;
};

export type FinancialStatementKind =
  | 'STATEMENT_OF_FINANCIAL_POSITION'
  | 'MONTHLY_PROFIT_AND_LOSS'
  | 'CASH_FLOW_SUMMARY'
  | 'NET_WORTH_MOVEMENT';

export type FinancialStatementMetricItem = {
  label: string;
  amountWon: number;
};

export type FinancialStatementSectionItem = {
  label: string;
  amountWon: number;
};

export type FinancialStatementSection = {
  title: string;
  items: FinancialStatementSectionItem[];
};

export type FinancialStatementPayload = {
  summary: FinancialStatementMetricItem[];
  sections: FinancialStatementSection[];
  notes: string[];
};

export type FinancialStatementSnapshotItem = {
  id: string;
  periodId: string;
  monthLabel: string;
  statementKind: FinancialStatementKind;
  currency: string;
  payload: FinancialStatementPayload;
  createdAt: string;
};

export type GenerateFinancialStatementSnapshotsRequest = {
  periodId: string;
};

export type FinancialStatementsView = {
  period: AccountingPeriodItem;
  snapshots: FinancialStatementSnapshotItem[];
};

export type GenerateFinancialStatementSnapshotsResponse =
  FinancialStatementsView;

export type AccountType = 'BANK' | 'CASH' | 'CARD';
export type CategoryKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type InsuranceCycle = 'MONTHLY' | 'YEARLY';
export type FuelType = 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthenticatedUser;
};

export type FundingAccountItem = {
  id: string;
  name: string;
  type: AccountType;
  balanceWon: number;
};

export type CategoryItem = {
  id: string;
  name: string;
  kind: CategoryKind;
};

export type AccountSubjectStatementType = 'BALANCE_SHEET' | 'PROFIT_AND_LOSS';
export type AccountNormalSide = 'DEBIT' | 'CREDIT';
export type AccountSubjectKind =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'INCOME'
  | 'EXPENSE';

export type AccountSubjectItem = {
  id: string;
  code: string;
  name: string;
  statementType: AccountSubjectStatementType;
  normalSide: AccountNormalSide;
  subjectKind: AccountSubjectKind;
  isSystem: boolean;
  isActive: boolean;
};

export type LedgerTransactionFlowKind =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'OPENING_BALANCE'
  | 'CARRY_FORWARD';
export type PostingPolicyKey =
  | 'INCOME_BASIC'
  | 'EXPENSE_BASIC'
  | 'TRANSFER_BASIC'
  | 'CARD_SPEND'
  | 'CARD_PAYMENT'
  | 'OPENING_BALANCE'
  | 'CARRY_FORWARD'
  | 'MANUAL_ADJUSTMENT';

export type LedgerTransactionTypeItem = {
  id: string;
  code: string;
  name: string;
  flowKind: LedgerTransactionFlowKind;
  postingPolicyKey: PostingPolicyKey;
  isActive: boolean;
};

export type CollectedTransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type CollectedTransactionSourceKind = 'MANUAL' | 'RECURRING' | 'IMPORT';
export type CollectedTransactionPostingStatus =
  | 'POSTED'
  | 'PENDING'
  | 'CANCELLED';

export type CollectedTransactionItem = {
  id: string;
  businessDate: string;
  title: string;
  type: CollectedTransactionType;
  amountWon: number;
  fundingAccountName: string;
  categoryName: string;
  sourceKind: CollectedTransactionSourceKind;
  postingStatus: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
};

export type CreateCollectedTransactionRequest = {
  title: string;
  type: CollectedTransactionType;
  amountWon: number;
  businessDate: string;
  fundingAccountId: string;
  categoryId?: string;
  memo?: string;
};

export type JournalEntryStatus = 'POSTED' | 'REVERSED' | 'SUPERSEDED';
export type JournalEntrySourceKind =
  | 'COLLECTED_TRANSACTION'
  | 'PLAN_SETTLEMENT'
  | 'OPENING_BALANCE'
  | 'CARRY_FORWARD'
  | 'MANUAL_ADJUSTMENT';

export type JournalLineItem = {
  id: string;
  lineNumber: number;
  accountSubjectCode: string;
  accountSubjectName: string;
  fundingAccountName: string | null;
  debitAmount: number;
  creditAmount: number;
  description: string | null;
};

export type JournalEntryItem = {
  id: string;
  entryNumber: string;
  entryDate: string;
  status: JournalEntryStatus;
  sourceKind: JournalEntrySourceKind;
  memo: string | null;
  sourceCollectedTransactionId: string | null;
  sourceCollectedTransactionTitle: string | null;
  lines: JournalLineItem[];
};

export type RecurringRuleItem = {
  id: string;
  title: string;
  amountWon: number;
  frequency: RecurrenceFrequency;
  nextRunDate: string | null;
  fundingAccountName: string;
  categoryName: string;
  isActive: boolean;
};

export type CreateRecurringRuleRequest = {
  title: string;
  fundingAccountId: string;
  categoryId?: string;
  amountWon: number;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
};

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

export type InsurancePolicyItem = {
  id: string;
  provider: string;
  productName: string;
  monthlyPremiumWon: number;
  paymentDay: number;
  cycle: InsuranceCycle;
  renewalDate: string | null;
  maturityDate: string | null;
};

export type FuelLogItem = {
  id: string;
  filledOn: string;
  odometerKm: number;
  liters: number;
  amountWon: number;
  unitPriceWon: number;
  isFullTank: boolean;
};

export type VehicleItem = {
  id: string;
  name: string;
  manufacturer: string | null;
  fuelType: FuelType;
  initialOdometerKm: number;
  monthlyExpenseWon: number;
  estimatedFuelEfficiencyKmPerLiter: number | null;
  fuelLogs?: FuelLogItem[];
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
