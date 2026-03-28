import type { CategoryItem, FundingAccountItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockFundingAccounts: FundingAccountItem[] = [
  { id: 'acc-1', name: '주거래 통장', type: 'BANK', balanceWon: 2450000 },
  { id: 'acc-2', name: '생활비 통장', type: 'BANK', balanceWon: 430000 },
  { id: 'acc-3', name: '신용카드', type: 'CARD', balanceWon: 300000 }
];

export const mockCategories: CategoryItem[] = [
  { id: 'cat-1', name: '급여', kind: 'INCOME' },
  { id: 'cat-2', name: '식비', kind: 'EXPENSE' },
  { id: 'cat-3', name: '보험', kind: 'EXPENSE' },
  { id: 'cat-4', name: '주유', kind: 'EXPENSE' },
  { id: 'cat-5', name: '통신비', kind: 'EXPENSE' }
];

export function getFundingAccounts() {
  return fetchJson<FundingAccountItem[]>('/funding-accounts', mockFundingAccounts);
}

export function getCategories() {
  return fetchJson<CategoryItem[]>('/categories', mockCategories);
}
