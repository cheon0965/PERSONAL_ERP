import type {
  AccountSubjectItem,
  CorrectJournalEntryRequest,
  FundingAccountItem,
  JournalEntryItem,
  ReverseJournalEntryRequest
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

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
        accountSubjectName: '보통예금',
        fundingAccountName: '주거래 통장',
        debitAmount: 3200000,
        creditAmount: 0,
        description: '3월 급여'
      },
      {
        id: 'jel-demo-2',
        lineNumber: 2,
        accountSubjectCode: '4100',
        accountSubjectName: '영업수익',
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

export function reverseJournalEntry(
  journalEntryId: string,
  input: ReverseJournalEntryRequest,
  fallback: JournalEntryItem
) {
  return postJson<JournalEntryItem, ReverseJournalEntryRequest>(
    `/journal-entries/${journalEntryId}/reverse`,
    input,
    fallback
  );
}

export function correctJournalEntry(
  journalEntryId: string,
  input: CorrectJournalEntryRequest,
  fallback: JournalEntryItem
) {
  return postJson<JournalEntryItem, CorrectJournalEntryRequest>(
    `/journal-entries/${journalEntryId}/correct`,
    input,
    fallback
  );
}

export function buildReverseJournalEntryFallbackItem(
  entry: JournalEntryItem,
  input: ReverseJournalEntryRequest
): JournalEntryItem {
  return {
    id: `je-demo-reverse-${Date.now()}`,
    entryNumber: 'DEMO-REVERSE',
    entryDate: `${input.entryDate}T00:00:00.000Z`,
    status: 'POSTED',
    sourceKind: 'MANUAL_ADJUSTMENT',
    memo: input.reason?.trim() || `Reversal of ${entry.entryNumber}`,
    sourceCollectedTransactionId: null,
    sourceCollectedTransactionTitle: null,
    lines: entry.lines.map((line, index) => ({
      id: `jel-demo-reverse-${index + 1}`,
      lineNumber: index + 1,
      accountSubjectCode: line.accountSubjectCode,
      accountSubjectName: line.accountSubjectName,
      fundingAccountName: line.fundingAccountName,
      debitAmount: line.creditAmount,
      creditAmount: line.debitAmount,
      description: line.description
    }))
  };
}

export function buildCorrectJournalEntryFallbackItem(
  entry: JournalEntryItem,
  input: CorrectJournalEntryRequest,
  referenceData: {
    accountSubjects: AccountSubjectItem[];
    fundingAccounts: FundingAccountItem[];
  }
): JournalEntryItem {
  return {
    id: `je-demo-correct-${Date.now()}`,
    entryNumber: 'DEMO-CORRECT',
    entryDate: `${input.entryDate}T00:00:00.000Z`,
    status: 'POSTED',
    sourceKind: 'MANUAL_ADJUSTMENT',
    memo: input.reason,
    sourceCollectedTransactionId: null,
    sourceCollectedTransactionTitle: null,
    lines: input.lines.map((line, index) => {
      const accountSubject =
        referenceData.accountSubjects.find(
          (candidate) => candidate.id === line.accountSubjectId
        ) ?? null;
      const fundingAccount =
        line.fundingAccountId == null
          ? null
          : (referenceData.fundingAccounts.find(
              (candidate) => candidate.id === line.fundingAccountId
            ) ?? null);

      return {
        id: `jel-demo-correct-${index + 1}`,
        lineNumber: index + 1,
        accountSubjectCode: accountSubject?.code ?? '',
        accountSubjectName: accountSubject?.name ?? '계정과목',
        fundingAccountName: fundingAccount?.name ?? null,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description?.trim() || null
      };
    })
  };
}
