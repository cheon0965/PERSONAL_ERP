import type { TransactionItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockTransactions: TransactionItem[] = [
  {
    id: 'txn-1',
    businessDate: '2026-03-01',
    title: 'March salary',
    type: 'INCOME',
    amountWon: 3200000,
    accountName: 'Main checking',
    categoryName: 'Salary',
    origin: 'MANUAL',
    status: 'POSTED'
  },
  {
    id: 'txn-2',
    businessDate: '2026-03-03',
    title: 'Fuel refill',
    type: 'EXPENSE',
    amountWon: 84000,
    accountName: 'Living expenses',
    categoryName: 'Fuel',
    origin: 'MANUAL',
    status: 'POSTED'
  },
  {
    id: 'txn-3',
    businessDate: '2026-03-10',
    title: 'Mobile bill transfer',
    type: 'EXPENSE',
    amountWon: 75000,
    accountName: 'Main checking',
    categoryName: 'Telecom',
    origin: 'RECURRING',
    status: 'POSTED'
  },
  {
    id: 'txn-4',
    businessDate: '2026-03-12',
    title: 'Grocery run',
    type: 'EXPENSE',
    amountWon: 126000,
    accountName: 'Living expenses',
    categoryName: 'Groceries',
    origin: 'MANUAL',
    status: 'POSTED'
  }
];

export function getTransactions() {
  return fetchJson<TransactionItem[]>('/transactions', mockTransactions);
}
