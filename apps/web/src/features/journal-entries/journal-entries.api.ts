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
    reversesJournalEntryId: null,
    reversesJournalEntryNumber: null,
    reversedByJournalEntryId: null,
    reversedByJournalEntryNumber: null,
    correctsJournalEntryId: null,
    correctsJournalEntryNumber: null,
    correctionEntryIds: [],
    correctionEntryNumbers: [],
    correctionReason: null,
    createdByActorType: 'TENANT_MEMBERSHIP',
    createdByMembershipId: 'membership-demo',
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
  },
  {
    id: 'je-demo-2',
    entryNumber: '202603-0002',
    entryDate: '2026-03-03T00:00:00.000Z',
    status: 'SUPERSEDED',
    sourceKind: 'COLLECTED_TRANSACTION',
    memo: '주유',
    sourceCollectedTransactionId: 'txn-2',
    sourceCollectedTransactionTitle: '주유',
    reversesJournalEntryId: null,
    reversesJournalEntryNumber: null,
    reversedByJournalEntryId: null,
    reversedByJournalEntryNumber: null,
    correctsJournalEntryId: null,
    correctsJournalEntryNumber: null,
    correctionEntryIds: ['je-demo-2-c1'],
    correctionEntryNumbers: ['202604-0001'],
    correctionReason: null,
    createdByActorType: 'TENANT_MEMBERSHIP',
    createdByMembershipId: 'membership-demo',
    lines: [
      {
        id: 'jel-demo-2-1',
        lineNumber: 1,
        accountSubjectCode: '5100',
        accountSubjectName: '차량유지비',
        fundingAccountName: null,
        debitAmount: 84000,
        creditAmount: 0,
        description: '주유'
      },
      {
        id: 'jel-demo-2-2',
        lineNumber: 2,
        accountSubjectCode: '1010',
        accountSubjectName: '보통예금',
        fundingAccountName: '생활비 통장',
        debitAmount: 0,
        creditAmount: 84000,
        description: '주유'
      }
    ]
  },
  {
    id: 'je-demo-2-c1',
    entryNumber: '202604-0001',
    entryDate: '2026-04-04T00:00:00.000Z',
    status: 'POSTED',
    sourceKind: 'MANUAL_ADJUSTMENT',
    memo: '카드 승인 금액 확인 후 정정',
    sourceCollectedTransactionId: null,
    sourceCollectedTransactionTitle: null,
    reversesJournalEntryId: null,
    reversesJournalEntryNumber: null,
    reversedByJournalEntryId: null,
    reversedByJournalEntryNumber: null,
    correctsJournalEntryId: 'je-demo-2',
    correctsJournalEntryNumber: '202603-0002',
    correctionEntryIds: [],
    correctionEntryNumbers: [],
    correctionReason: '카드 승인 금액 확인 후 정정',
    createdByActorType: 'TENANT_MEMBERSHIP',
    createdByMembershipId: 'membership-demo',
    lines: [
      {
        id: 'jel-demo-2-c1-1',
        lineNumber: 1,
        accountSubjectCode: '5100',
        accountSubjectName: '차량유지비',
        fundingAccountName: null,
        debitAmount: 95000,
        creditAmount: 0,
        description: '정정 주유'
      },
      {
        id: 'jel-demo-2-c1-2',
        lineNumber: 2,
        accountSubjectCode: '1010',
        accountSubjectName: '보통예금',
        fundingAccountName: '생활비 통장',
        debitAmount: 0,
        creditAmount: 95000,
        description: '정정 주유'
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
    reversesJournalEntryId: entry.id,
    reversesJournalEntryNumber: entry.entryNumber,
    reversedByJournalEntryId: null,
    reversedByJournalEntryNumber: null,
    correctsJournalEntryId: null,
    correctsJournalEntryNumber: null,
    correctionEntryIds: [],
    correctionEntryNumbers: [],
    correctionReason: null,
    createdByActorType: 'TENANT_MEMBERSHIP',
    createdByMembershipId: null,
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
    reversesJournalEntryId: null,
    reversesJournalEntryNumber: null,
    reversedByJournalEntryId: null,
    reversedByJournalEntryNumber: null,
    correctsJournalEntryId: entry.id,
    correctsJournalEntryNumber: entry.entryNumber,
    correctionEntryIds: [],
    correctionEntryNumbers: [],
    correctionReason: input.reason,
    createdByActorType: 'TENANT_MEMBERSHIP',
    createdByMembershipId: null,
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
