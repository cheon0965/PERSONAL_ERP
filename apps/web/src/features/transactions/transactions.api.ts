import type {
  CreateTransactionRequest,
  TransactionItem
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export const transactionsQueryKey = ['transactions'] as const;

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

export function createTransaction(
  input: CreateTransactionRequest,
  fallback: TransactionItem
) {
  return postJson<TransactionItem, CreateTransactionRequest>(
    '/transactions',
    input,
    fallback
  );
}

export function buildTransactionFallbackItem(
  input: CreateTransactionRequest,
  context: {
    accountName: string;
    categoryName?: string;
  }
): TransactionItem {
  return {
    id: `txn-demo-${Date.now()}`,
    businessDate: input.businessDate,
    title: input.title,
    type: input.type,
    amountWon: input.amountWon,
    accountName: context.accountName,
    categoryName: context.categoryName ?? '-',
    origin: 'MANUAL',
    status: 'POSTED'
  };
}

export function mergeTransactionItem(
  current: TransactionItem[] | undefined,
  created: TransactionItem
): TransactionItem[] {
  return [created, ...(current ?? []).filter((item) => item.id !== created.id)].sort(
    (left, right) => right.businessDate.localeCompare(left.businessDate)
  );
}
