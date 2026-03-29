import type { JournalEntryItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const journalEntriesQueryKey = ['journal-entries'] as const;

export const mockJournalEntries: JournalEntryItem[] = [
  {
    id: 'je-demo-1',
    entryNumber: '202603-0001',
    entryDate: '2026-03-01T00:00:00.000Z',
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    memo: '3월 급여',
    sourceCollectedTransactionId: 'txn-1',
    sourceCollectedTransactionTitle: '3월 급여',
    lines: [
      {
        id: 'jel-demo-1',
        lineNumber: 1,
        accountSubjectCode: '1010',
        accountSubjectName: '현금및예금',
        fundingAccountName: '주거래 통장',
        debitAmount: 3200000,
        creditAmount: 0,
        description: '3월 급여'
      },
      {
        id: 'jel-demo-2',
        lineNumber: 2,
        accountSubjectCode: '4100',
        accountSubjectName: '운영수익',
        fundingAccountName: null,
        debitAmount: 0,
        creditAmount: 3200000,
        description: '3월 급여'
      }
    ]
  }
];

export function getJournalEntries() {
  return fetchJson<JournalEntryItem[]>('/journal-entries', mockJournalEntries);
}
