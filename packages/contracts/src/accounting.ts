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
