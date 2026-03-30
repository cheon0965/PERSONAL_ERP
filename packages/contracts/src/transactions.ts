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
