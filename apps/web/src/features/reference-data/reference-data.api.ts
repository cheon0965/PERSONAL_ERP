import type {
  AccountSubjectItem,
  CategoryItem,
  FundingAccountItem,
  LedgerTransactionTypeItem
} from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const fundingAccountsQueryKey = [
  'reference-data',
  'funding-accounts'
] as const;
export const categoriesQueryKey = ['reference-data', 'categories'] as const;
export const accountSubjectsQueryKey = [
  'reference-data',
  'account-subjects'
] as const;
export const ledgerTransactionTypesQueryKey = [
  'reference-data',
  'ledger-transaction-types'
] as const;

export const mockFundingAccounts: FundingAccountItem[] = [
  { id: 'acc-1', name: '주거래 통장', type: 'BANK', balanceWon: 2_450_000 },
  { id: 'acc-2', name: '생활비 통장', type: 'BANK', balanceWon: 430_000 },
  { id: 'acc-3', name: '주사용 카드', type: 'CARD', balanceWon: 300_000 }
];

export const mockCategories: CategoryItem[] = [
  { id: 'cat-1', name: '급여', kind: 'INCOME' },
  { id: 'cat-2', name: '식비', kind: 'EXPENSE' },
  { id: 'cat-3', name: '보험', kind: 'EXPENSE' },
  { id: 'cat-4', name: '주유', kind: 'EXPENSE' },
  { id: 'cat-5', name: '통신비', kind: 'EXPENSE' }
];

export const mockAccountSubjects: AccountSubjectItem[] = [
  {
    id: 'as-1010',
    code: '1010',
    name: '현금및예금',
    statementType: 'BALANCE_SHEET',
    normalSide: 'DEBIT',
    subjectKind: 'ASSET',
    isSystem: true,
    isActive: true
  },
  {
    id: 'as-4100',
    code: '4100',
    name: '운영수익',
    statementType: 'PROFIT_AND_LOSS',
    normalSide: 'CREDIT',
    subjectKind: 'INCOME',
    isSystem: true,
    isActive: true
  },
  {
    id: 'as-5100',
    code: '5100',
    name: '운영비용',
    statementType: 'PROFIT_AND_LOSS',
    normalSide: 'DEBIT',
    subjectKind: 'EXPENSE',
    isSystem: true,
    isActive: true
  }
];

export const mockLedgerTransactionTypes: LedgerTransactionTypeItem[] = [
  {
    id: 'ltt-income-basic',
    code: 'INCOME_BASIC',
    name: '기본 수입',
    flowKind: 'INCOME',
    postingPolicyKey: 'INCOME_BASIC',
    isActive: true
  },
  {
    id: 'ltt-expense-basic',
    code: 'EXPENSE_BASIC',
    name: '기본 지출',
    flowKind: 'EXPENSE',
    postingPolicyKey: 'EXPENSE_BASIC',
    isActive: true
  },
  {
    id: 'ltt-transfer-basic',
    code: 'TRANSFER_BASIC',
    name: '기본 이체',
    flowKind: 'TRANSFER',
    postingPolicyKey: 'TRANSFER_BASIC',
    isActive: true
  }
];

export function getFundingAccounts() {
  return fetchJson<FundingAccountItem[]>(
    '/funding-accounts',
    mockFundingAccounts
  );
}

export function getCategories() {
  return fetchJson<CategoryItem[]>('/categories', mockCategories);
}

export function getAccountSubjects() {
  return fetchJson<AccountSubjectItem[]>(
    '/account-subjects',
    mockAccountSubjects
  );
}

export function getLedgerTransactionTypes() {
  return fetchJson<LedgerTransactionTypeItem[]>(
    '/ledger-transaction-types',
    mockLedgerTransactionTypes
  );
}
