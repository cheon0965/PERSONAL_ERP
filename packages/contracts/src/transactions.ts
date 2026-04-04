import type { AuditActorType } from './accounting';

export type CollectedTransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export type CollectedTransactionSourceKind = 'MANUAL' | 'RECURRING' | 'IMPORT';

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
  amountWon: number;
  fundingAccountName: string;
  categoryName: string;
  sourceKind: CollectedTransactionSourceKind;
  postingStatus: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
};

export type CollectedTransactionDetailItem = {
  id: string;
  businessDate: string;
  title: string;
  type: CollectedTransactionType;
  amountWon: number;
  fundingAccountId: string;
  categoryId: string | null;
  memo: string | null;
  sourceKind: CollectedTransactionSourceKind;
  postingStatus: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
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

export type ReverseJournalEntryRequest = {
  entryDate: string;
  reason?: string;
};

export type CorrectJournalEntryLineInput = {
  accountSubjectId: string;
  fundingAccountId?: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
};

export type CorrectJournalEntryRequest = {
  entryDate: string;
  reason: string;
  lines: CorrectJournalEntryLineInput[];
};
