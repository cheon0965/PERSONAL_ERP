import type {
  CollectedTransactionItem,
  CreateCollectedTransactionRequest
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export const collectedTransactionsQueryKey = ['collected-transactions'] as const;

export const mockCollectedTransactions: CollectedTransactionItem[] = [
  {
    id: 'txn-1',
    businessDate: '2026-03-01',
    title: '3월 급여',
    type: 'INCOME',
    amountWon: 3200000,
    fundingAccountName: '주거래 통장',
    categoryName: '급여',
    sourceKind: 'MANUAL',
    postingStatus: 'POSTED'
  },
  {
    id: 'txn-2',
    businessDate: '2026-03-03',
    title: '주유',
    type: 'EXPENSE',
    amountWon: 84000,
    fundingAccountName: '생활비 통장',
    categoryName: '주유',
    sourceKind: 'MANUAL',
    postingStatus: 'POSTED'
  },
  {
    id: 'txn-3',
    businessDate: '2026-03-10',
    title: '휴대폰 요금 이체',
    type: 'EXPENSE',
    amountWon: 75000,
    fundingAccountName: '주거래 통장',
    categoryName: '통신비',
    sourceKind: 'RECURRING',
    postingStatus: 'POSTED'
  },
  {
    id: 'txn-4',
    businessDate: '2026-03-12',
    title: '장보기',
    type: 'EXPENSE',
    amountWon: 126000,
    fundingAccountName: '생활비 통장',
    categoryName: '식비',
    sourceKind: 'MANUAL',
    postingStatus: 'POSTED'
  }
];

export function getCollectedTransactions() {
  return fetchJson<CollectedTransactionItem[]>(
    '/collected-transactions',
    mockCollectedTransactions
  );
}

export function createCollectedTransaction(
  input: CreateCollectedTransactionRequest,
  fallback: CollectedTransactionItem
) {
  return postJson<CollectedTransactionItem, CreateCollectedTransactionRequest>(
    '/collected-transactions',
    input,
    fallback
  );
}

export function buildCollectedTransactionFallbackItem(
  input: CreateCollectedTransactionRequest,
  context: {
    fundingAccountName: string;
    categoryName?: string;
  }
): CollectedTransactionItem {
  return {
    id: `txn-demo-${Date.now()}`,
    businessDate: input.businessDate,
    title: input.title,
    type: input.type,
    amountWon: input.amountWon,
    fundingAccountName: context.fundingAccountName,
    categoryName: context.categoryName ?? '-',
    sourceKind: 'MANUAL',
    postingStatus: 'POSTED'
  };
}

export function mergeCollectedTransactionItem(
  current: CollectedTransactionItem[] | undefined,
  created: CollectedTransactionItem
): CollectedTransactionItem[] {
  return [created, ...(current ?? []).filter((item) => item.id !== created.id)].sort(
    (left, right) => right.businessDate.localeCompare(left.businessDate)
  );
}
