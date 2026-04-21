import type {
  BulkConfirmCollectedTransactionsRequest,
  BulkConfirmCollectedTransactionsResponse,
  CollectedTransactionDetailItem,
  CollectedTransactionItem,
  CreateCollectedTransactionRequest,
  JournalEntryItem,
  UpdateCollectedTransactionRequest
} from '@personal-erp/contracts';
import {
  deleteJson,
  fetchJson,
  patchJson,
  postJson
} from '@/shared/api/fetch-json';
import {
  editableCollectedTransactionStatuses,
  resolveManualCollectedTransactionPostingStatus
} from './transaction-workflow';

export const collectedTransactionsQueryKey = [
  'collected-transactions'
] as const;

export const collectedTransactionDetailQueryKey = (
  collectedTransactionId: string
) => ['collected-transactions', collectedTransactionId] as const;

export const mockCollectedTransactions: CollectedTransactionItem[] = [
  {
    id: 'txn-1',
    businessDate: '2026-03-01',
    title: '3월 스마트스토어 매출',
    type: 'INCOME',
    amountWon: 3200000,
    fundingAccountName: '사업 운영 통장',
    categoryName: '매출 입금',
    sourceKind: 'MANUAL',
    postingStatus: 'POSTED',
    postedJournalEntryId: 'je-demo-1',
    postedJournalEntryNumber: '202603-0001',
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  },
  {
    id: 'txn-2',
    businessDate: '2026-03-03',
    title: '배송 차량 주유',
    type: 'EXPENSE',
    amountWon: 84000,
    fundingAccountName: '비용 예비 통장',
    categoryName: '배송 차량 유류비',
    sourceKind: 'MANUAL',
    postingStatus: 'READY_TO_POST',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  },
  {
    id: 'txn-3',
    businessDate: '2026-03-10',
    title: 'POS/인터넷 요금 자동이체',
    type: 'EXPENSE',
    amountWon: 75000,
    fundingAccountName: '사업 운영 통장',
    categoryName: '통신·POS 비용',
    sourceKind: 'RECURRING',
    postingStatus: 'POSTED',
    postedJournalEntryId: 'je-demo-3',
    postedJournalEntryNumber: '202603-0003',
    matchedPlanItemId: 'plan-demo-1',
    matchedPlanItemTitle: 'POS/인터넷 요금'
  },
  {
    id: 'txn-4',
    businessDate: '2026-03-12',
    title: '사장실 구매',
    type: 'EXPENSE',
    amountWon: 126000,
    fundingAccountName: '비용 예비 통장',
    categoryName: '-',
    sourceKind: 'MANUAL',
    postingStatus: 'REVIEWED',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  }
];

const mockCollectedTransactionDetails: Record<
  string,
  CollectedTransactionDetailItem
> = {
  'txn-1': {
    id: 'txn-1',
    businessDate: '2026-03-01',
    title: '3월 스마트스토어 매출',
    type: 'INCOME',
    amountWon: 3200000,
    fundingAccountId: 'acc-1',
    categoryId: 'cat-1',
    memo: null,
    sourceKind: 'MANUAL',
    postingStatus: 'POSTED',
    postedJournalEntryId: 'je-demo-1',
    postedJournalEntryNumber: '202603-0001',
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  },
  'txn-2': {
    id: 'txn-2',
    businessDate: '2026-03-03',
    title: '배송 차량 주유',
    type: 'EXPENSE',
    amountWon: 84000,
    fundingAccountId: 'acc-2',
    categoryId: 'cat-4',
    memo: '업무용 차량 만땅',
    sourceKind: 'MANUAL',
    postingStatus: 'READY_TO_POST',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  },
  'txn-3': {
    id: 'txn-3',
    businessDate: '2026-03-10',
    title: 'POS/인터넷 요금 자동이체',
    type: 'EXPENSE',
    amountWon: 75000,
    fundingAccountId: 'acc-1',
    categoryId: 'cat-5',
    memo: '정기 운영비 자동이체',
    sourceKind: 'RECURRING',
    postingStatus: 'POSTED',
    postedJournalEntryId: 'je-demo-3',
    postedJournalEntryNumber: '202603-0003',
    matchedPlanItemId: 'plan-demo-1',
    matchedPlanItemTitle: 'POS/인터넷 요금'
  },
  'txn-4': {
    id: 'txn-4',
    businessDate: '2026-03-12',
    title: '사장실 구매',
    type: 'EXPENSE',
    amountWon: 126000,
    fundingAccountId: 'acc-2',
    categoryId: null,
    memo: '사장실 박스 및 소모품 보충',
    sourceKind: 'MANUAL',
    postingStatus: 'REVIEWED',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  }
};

export function getCollectedTransactions() {
  return fetchJson<CollectedTransactionItem[]>(
    '/collected-transactions',
    mockCollectedTransactions
  );
}

export function getCollectedTransactionDetail(collectedTransactionId: string) {
  return fetchJson<CollectedTransactionDetailItem>(
    `/collected-transactions/${collectedTransactionId}`,
    resolveCollectedTransactionDetailFallback(collectedTransactionId)
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

export function updateCollectedTransaction(
  collectedTransactionId: string,
  input: UpdateCollectedTransactionRequest,
  fallback: CollectedTransactionItem
) {
  return patchJson<CollectedTransactionItem, UpdateCollectedTransactionRequest>(
    `/collected-transactions/${collectedTransactionId}`,
    input,
    fallback
  );
}

export function deleteCollectedTransaction(collectedTransactionId: string) {
  return deleteJson<null>(
    `/collected-transactions/${collectedTransactionId}`,
    null
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

export function bulkConfirmCollectedTransactions(
  input: BulkConfirmCollectedTransactionsRequest
) {
  return postJson<
    BulkConfirmCollectedTransactionsResponse,
    BulkConfirmCollectedTransactionsRequest
  >('/collected-transactions/confirm-bulk', input, {
    requestedCount: input.transactionIds?.length ?? 0,
    processedCount: 0,
    succeededCount: 0,
    skippedCount: 0,
    failedCount: 0,
    results: []
  });
}

export function buildCollectedTransactionFallbackItem(
  input: CreateCollectedTransactionRequest,
  context: {
    fundingAccountName: string;
    categoryName?: string;
    id?: string;
    sourceKind?: CollectedTransactionItem['sourceKind'];
    postingStatus?: CollectedTransactionItem['postingStatus'];
    postedJournalEntryId?: string | null;
    postedJournalEntryNumber?: string | null;
    matchedPlanItemId?: string | null;
    matchedPlanItemTitle?: string | null;
  }
): CollectedTransactionItem {
  const computedPostingStatus = resolveManualCollectedTransactionPostingStatus({
    type: input.type,
    categoryId: input.categoryId
  });
  const preservedPostingStatus =
    context.postingStatus &&
    !editableCollectedTransactionStatuses.includes(
      context.postingStatus as (typeof editableCollectedTransactionStatuses)[number]
    )
      ? context.postingStatus
      : computedPostingStatus;

  return {
    id: context.id ?? `txn-demo-${Date.now()}`,
    businessDate: input.businessDate,
    title: input.title,
    type: input.type,
    amountWon: input.amountWon,
    fundingAccountName: context.fundingAccountName,
    categoryName: context.categoryName ?? '-',
    sourceKind: context.sourceKind ?? 'MANUAL',
    postingStatus: preservedPostingStatus,
    postedJournalEntryId: context.postedJournalEntryId ?? null,
    postedJournalEntryNumber: context.postedJournalEntryNumber ?? null,
    matchedPlanItemId: context.matchedPlanItemId ?? null,
    matchedPlanItemTitle: context.matchedPlanItemTitle ?? null
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

export function removeCollectedTransactionItem(
  current: CollectedTransactionItem[] | undefined,
  collectedTransactionId: string
): CollectedTransactionItem[] {
  return (current ?? []).filter((item) => item.id !== collectedTransactionId);
}

function resolveCollectedTransactionDetailFallback(
  collectedTransactionId: string
): CollectedTransactionDetailItem {
  const mockDetail = mockCollectedTransactionDetails[collectedTransactionId];
  if (mockDetail) {
    return mockDetail;
  }

  const base = mockCollectedTransactions.find(
    (item) => item.id === collectedTransactionId
  );

  return {
    id: collectedTransactionId,
    businessDate: base?.businessDate ?? '2026-03-01',
    title: base?.title ?? '수집 거래',
    type: base?.type ?? 'EXPENSE',
    amountWon: base?.amountWon ?? 0,
    fundingAccountId: 'acc-1',
    categoryId: null,
    memo: null,
    sourceKind: base?.sourceKind ?? 'MANUAL',
    postingStatus:
      base?.postingStatus ??
      resolveManualCollectedTransactionPostingStatus({
        type: base?.type ?? 'EXPENSE',
        categoryId: null
      }),
    postedJournalEntryId: base?.postedJournalEntryId ?? null,
    postedJournalEntryNumber: base?.postedJournalEntryNumber ?? null,
    matchedPlanItemId: base?.matchedPlanItemId ?? null,
    matchedPlanItemTitle: base?.matchedPlanItemTitle ?? null
  };
}
