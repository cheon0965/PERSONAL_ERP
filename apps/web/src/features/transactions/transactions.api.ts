import type {
  CollectedTransactionItem,
  CreateCollectedTransactionRequest,
  JournalEntryItem
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export const collectedTransactionsQueryKey = [
  'collected-transactions'
] as const;

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
    postingStatus: 'POSTED',
    postedJournalEntryId: 'je-demo-1',
    postedJournalEntryNumber: '202603-0001'
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
    postingStatus: 'CORRECTED',
    postedJournalEntryId: 'je-demo-2',
    postedJournalEntryNumber: '202603-0002'
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
    postingStatus: 'POSTED',
    postedJournalEntryId: 'je-demo-3',
    postedJournalEntryNumber: '202603-0003'
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
    postingStatus: 'POSTED',
    postedJournalEntryId: 'je-demo-4',
    postedJournalEntryNumber: '202603-0004'
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

export function confirmCollectedTransaction(
  collectedTransactionId: string,
  fallback: JournalEntryItem
) {
  return postJson<JournalEntryItem, Record<string, never>>(
    `/collected-transactions/${collectedTransactionId}/confirm`,
    {},
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
    postingStatus: 'PENDING',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null
  };
}

export function mergeCollectedTransactionItem(
  current: CollectedTransactionItem[] | undefined,
  created: CollectedTransactionItem
): CollectedTransactionItem[] {
  return [
    created,
    ...(current ?? []).filter((item) => item.id !== created.id)
  ].sort((left, right) => right.businessDate.localeCompare(left.businessDate));
}
