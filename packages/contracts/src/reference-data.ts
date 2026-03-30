export type AccountType = 'BANK' | 'CASH' | 'CARD';

export type CategoryKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';

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
