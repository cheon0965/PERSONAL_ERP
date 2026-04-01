import type {
  AccountingPeriodItem,
  CollectedTransactionItem,
  JournalEntryItem
} from '@personal-erp/contracts';

export const sourceKindLabelMap: Record<string, string> = {
  MANUAL: '직접 입력',
  RECURRING: '반복 규칙 생성',
  IMPORT: '파일 업로드'
};

export function resolveLatestLinkedJournalEntry(
  journalEntriesById: Map<string, JournalEntryItem>,
  journalEntryId: string | null
): JournalEntryItem | null {
  if (!journalEntryId) {
    return null;
  }

  let current = journalEntriesById.get(journalEntryId) ?? null;
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    const nextId =
      current.correctionEntryIds?.at(-1) ??
      current.reversedByJournalEntryId ??
      null;

    if (!nextId) {
      return current;
    }

    const next = journalEntriesById.get(nextId) ?? null;
    if (!next) {
      return current;
    }

    current = next;
  }

  return current;
}

export function isBusinessDateWithinPeriod(
  businessDate: string,
  currentPeriod: AccountingPeriodItem
): boolean {
  const businessTime = Date.parse(`${businessDate}T00:00:00.000Z`);
  const startTime = Date.parse(currentPeriod.startDate);
  const endTime = Date.parse(currentPeriod.endDate);

  return businessTime >= startTime && businessTime < endTime;
}

export function buildJournalEntryFallbackItem(
  transaction: CollectedTransactionItem
): JournalEntryItem {
  return {
    id: `je-demo-${transaction.id}`,
    entryNumber: 'DEMO',
    entryDate: `${transaction.businessDate}T00:00:00.000Z`,
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    memo: transaction.title,
    sourceCollectedTransactionId: transaction.id,
    sourceCollectedTransactionTitle: transaction.title,
    lines: []
  };
}
