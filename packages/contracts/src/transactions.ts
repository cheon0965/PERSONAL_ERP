import type { AuditActorType } from './accounting';
import type { MoneyWon } from './money';
import type { PostingPolicyKey } from './reference-data';

export type CollectedTransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'REVERSAL';

export type FundingAccountDirection = 'INFLOW' | 'OUTFLOW';

export type CollectedTransactionSourceKind =
  | 'MANUAL'
  | 'RECURRING'
  | 'IMPORT'
  | 'VEHICLE_LOG'
  | 'LIABILITY_REPAYMENT';

export type CollectedTransactionVehicleLogKind = 'FUEL' | 'MAINTENANCE';

export type CollectedTransactionVehicleLogSource = {
  kind: CollectedTransactionVehicleLogKind;
  logId: string;
  vehicleId: string;
  vehicleName: string;
};

export type CollectedTransactionLiabilityRepaymentSource = {
  repaymentScheduleId: string;
  liabilityAgreementId: string;
  liabilityAgreementTitle: string;
};

export type CollectedTransactionPostingStatus =
  | 'COLLECTED'
  | 'REVIEWED'
  | 'READY_TO_POST'
  | 'POSTED'
  | 'CORRECTED'
  | 'LOCKED';

export type CollectedTransactionItem = {
  id: string;
  businessDate: string;
  title: string;
  type: CollectedTransactionType;
  amountWon: MoneyWon;
  ledgerTransactionTypeId?: string;
  ledgerTransactionTypeName?: string;
  postingPolicyKey?: PostingPolicyKey;
  fundingAccountDirection?: FundingAccountDirection | null;
  fundingAccountName: string;
  counterpartyFundingAccountId?: string | null;
  counterpartyFundingAccountName?: string | null;
  categoryName: string;
  sourceKind: CollectedTransactionSourceKind;
  postingStatus: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
  sourceVehicleLog?: CollectedTransactionVehicleLogSource;
  sourceLiabilityRepayment?: CollectedTransactionLiabilityRepaymentSource;
};

export type CollectedTransactionDetailItem = {
  id: string;
  businessDate: string;
  title: string;
  type: CollectedTransactionType;
  amountWon: MoneyWon;
  ledgerTransactionTypeId?: string;
  ledgerTransactionTypeName?: string;
  postingPolicyKey?: PostingPolicyKey;
  fundingAccountDirection?: FundingAccountDirection | null;
  fundingAccountId: string;
  counterpartyFundingAccountId?: string | null;
  categoryId: string | null;
  memo: string | null;
  sourceKind: CollectedTransactionSourceKind;
  postingStatus: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
  sourceVehicleLog?: CollectedTransactionVehicleLogSource;
  sourceLiabilityRepayment?: CollectedTransactionLiabilityRepaymentSource;
};

export type CreateCollectedTransactionRequest = {
  title: string;
  type: CollectedTransactionType;
  amountWon: MoneyWon;
  businessDate: string;
  fundingAccountId: string;
  /** 명시 거래유형. 기존 클라이언트 호환을 위해 생략 시 type과 자금수단으로 안전하게 결정합니다. */
  ledgerTransactionTypeId?: string;
  counterpartyFundingAccountId?: string;
  fundingAccountDirection?: FundingAccountDirection;
  categoryId?: string;
  memo?: string;
};

export type UpdateCollectedTransactionRequest =
  CreateCollectedTransactionRequest;

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
  debitAmount: MoneyWon;
  creditAmount: MoneyWon;
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
  reversesJournalEntryId?: string | null;
  reversesJournalEntryNumber?: string | null;
  reversedByJournalEntryId?: string | null;
  reversedByJournalEntryNumber?: string | null;
  correctsJournalEntryId?: string | null;
  correctsJournalEntryNumber?: string | null;
  correctionEntryIds?: string[];
  correctionEntryNumbers?: string[];
  correctionReason?: string | null;
  createdByActorType?: AuditActorType;
  createdByMembershipId?: string | null;
  lines: JournalLineItem[];
};

export type BulkConfirmCollectedTransactionsRequest = {
  transactionIds?: string[];
};

export type BulkConfirmCollectedTransactionResultStatus =
  | 'CONFIRMED'
  | 'SKIPPED'
  | 'FAILED';

export type BulkConfirmCollectedTransactionResultItem = {
  collectedTransactionId: string;
  status: BulkConfirmCollectedTransactionResultStatus;
  journalEntryId: string | null;
  journalEntryNumber: string | null;
  message: string | null;
};

export type BulkConfirmCollectedTransactionsResponse = {
  requestedCount: number;
  processedCount: number;
  succeededCount: number;
  skippedCount: number;
  failedCount: number;
  results: BulkConfirmCollectedTransactionResultItem[];
};

export type ReverseJournalEntryRequest = {
  entryDate: string;
  reason?: string;
};

export type CorrectJournalEntryLineInput = {
  accountSubjectId: string;
  fundingAccountId?: string;
  debitAmount: MoneyWon;
  creditAmount: MoneyWon;
  description?: string;
};

export type CorrectJournalEntryRequest = {
  entryDate: string;
  reason: string;
  lines: CorrectJournalEntryLineInput[];
};
