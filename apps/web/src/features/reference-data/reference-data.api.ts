import type { AccountItem, CategoryItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockAccounts: AccountItem[] = [
  { id: 'acc-1', name: 'Main checking', type: 'BANK', balanceWon: 2450000 },
  { id: 'acc-2', name: 'Living expenses', type: 'BANK', balanceWon: 430000 },
  { id: 'acc-3', name: 'Credit card', type: 'CARD', balanceWon: 300000 }
];

export const mockCategories: CategoryItem[] = [
  { id: 'cat-1', name: 'Salary', kind: 'INCOME' },
  { id: 'cat-2', name: 'Groceries', kind: 'EXPENSE' },
  { id: 'cat-3', name: 'Insurance', kind: 'EXPENSE' },
  { id: 'cat-4', name: 'Fuel', kind: 'EXPENSE' },
  { id: 'cat-5', name: 'Telecom', kind: 'EXPENSE' }
];

export function getAccounts() {
  return fetchJson<AccountItem[]>('/accounts', mockAccounts);
}

export function getCategories() {
  return fetchJson<CategoryItem[]>('/categories', mockCategories);
}
