import type {
  AccountSubjectItem,
  CategoryItem,
  CreateCategoryRequest,
  CreateFundingAccountRequest,
  FundingAccountItem,
  LedgerTransactionTypeItem,
  ReferenceDataReadinessSummary,
  UpdateCategoryRequest,
  UpdateFundingAccountRequest
} from '@personal-erp/contracts';
import {
  deleteJson,
  fetchJson,
  patchJson,
  postJson
} from '@/shared/api/fetch-json';
import {
  mockAccountSubjects,
  mockCategories,
  mockFundingAccounts,
  mockLedgerTransactionTypes,
  mockReferenceDataReadiness
} from './reference-data.mock';
export const fundingAccountsQueryKey = [
  'reference-data',
  'funding-accounts'
] as const;
export const fundingAccountsManagementQueryKey = [
  'reference-data',
  'funding-accounts',
  'include-inactive'
] as const;
export const categoriesQueryKey = ['reference-data', 'categories'] as const;
export const categoriesManagementQueryKey = [
  'reference-data',
  'categories',
  'include-inactive'
] as const;
export const accountSubjectsQueryKey = [
  'reference-data',
  'account-subjects'
] as const;
export const ledgerTransactionTypesQueryKey = [
  'reference-data',
  'ledger-transaction-types'
] as const;
export const referenceDataReadinessQueryKey = [
  'reference-data',
  'readiness'
] as const;

export function getFundingAccounts(input?: { includeInactive?: boolean }) {
  const includeInactive = input?.includeInactive ?? false;

  return fetchJson<FundingAccountItem[]>(
    includeInactive
      ? '/funding-accounts?includeInactive=true'
      : '/funding-accounts',
    includeInactive
      ? mockFundingAccounts
      : mockFundingAccounts.filter(
          (fundingAccount) => fundingAccount.status === 'ACTIVE'
        )
  );
}

export function createFundingAccount(
  input: CreateFundingAccountRequest,
  fallback: FundingAccountItem
) {
  return postJson<FundingAccountItem, CreateFundingAccountRequest>(
    '/funding-accounts',
    input,
    fallback
  );
}

export function updateFundingAccount(
  fundingAccountId: string,
  input: UpdateFundingAccountRequest,
  fallback: FundingAccountItem
) {
  return patchJson<FundingAccountItem, UpdateFundingAccountRequest>(
    `/funding-accounts/${fundingAccountId}`,
    input,
    fallback
  );
}

export function deleteFundingAccount(fundingAccountId: string) {
  return deleteJson<null>(`/funding-accounts/${fundingAccountId}`, null);
}

export function getCategories(input?: { includeInactive?: boolean }) {
  const includeInactive = input?.includeInactive ?? false;

  return fetchJson<CategoryItem[]>(
    includeInactive ? '/categories?includeInactive=true' : '/categories',
    includeInactive
      ? mockCategories
      : mockCategories.filter((category) => category.isActive)
  );
}

export function createCategory(
  input: CreateCategoryRequest,
  fallback: CategoryItem
) {
  return postJson<CategoryItem, CreateCategoryRequest>(
    '/categories',
    input,
    fallback
  );
}

export function updateCategory(
  categoryId: string,
  input: UpdateCategoryRequest,
  fallback: CategoryItem
) {
  return patchJson<CategoryItem, UpdateCategoryRequest>(
    `/categories/${categoryId}`,
    input,
    fallback
  );
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

export function getReferenceDataReadiness() {
  return fetchJson<ReferenceDataReadinessSummary>(
    '/reference-data/readiness',
    mockReferenceDataReadiness
  );
}
