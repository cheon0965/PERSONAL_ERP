import type { TenantMembershipRole } from './auth';
import type { MoneyWon } from './money';

export type AccountType = 'BANK' | 'CASH' | 'CARD';

export type CategoryKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export type FundingAccountStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

export type FundingAccountBootstrapStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'COMPLETED';

export type FundingAccountItem = {
  id: string;
  name: string;
  type: AccountType;
  balanceWon: MoneyWon;
  status: FundingAccountStatus;
  bootstrapStatus: FundingAccountBootstrapStatus;
};

export type CreateFundingAccountRequest = {
  name: string;
  type: AccountType;
  initialBalanceWon?: MoneyWon;
};

export type CompleteFundingAccountBootstrapRequest = {
  initialBalanceWon?: MoneyWon | null;
};

export type UpdateFundingAccountRequest = {
  name: string;
  status?: FundingAccountStatus;
  bootstrapStatus?: FundingAccountBootstrapStatus;
};

export type CategoryItem = {
  id: string;
  name: string;
  kind: CategoryKind;
  isActive: boolean;
};

export type CreateCategoryRequest = {
  name: string;
  kind: CategoryKind;
};

export type UpdateCategoryRequest = {
  name: string;
  isActive?: boolean;
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

export type ReferenceDataOwnershipScope = 'USER_MANAGED' | 'SYSTEM_MANAGED';

export type ReferenceDataReadinessCheckKey =
  | 'funding-accounts'
  | 'income-categories'
  | 'expense-categories'
  | 'account-subjects'
  | 'ledger-transaction-types';

export type ReferenceDataReadinessStatus = 'READY' | 'ACTION_REQUIRED';

export type ReferenceDataReadinessCheckItem = {
  key: ReferenceDataReadinessCheckKey;
  label: string;
  description: string;
  ready: boolean;
  count: number;
  minimumRequiredCount: number;
  ownershipScope: ReferenceDataOwnershipScope;
  responsibleRoles: TenantMembershipRole[];
  inProductEditEnabled: boolean;
  operatingImpact: string;
  managementNote: string;
};

export type ReferenceDataReadinessSummary = {
  status: ReferenceDataReadinessStatus;
  currentRole: TenantMembershipRole | null;
  isReadyForMonthlyOperation: boolean;
  isReadyForTransactionEntry: boolean;
  isReadyForImportCollection: boolean;
  isReadyForRecurringRuleSetup: boolean;
  missingRequirements: string[];
  checks: ReferenceDataReadinessCheckItem[];
};
