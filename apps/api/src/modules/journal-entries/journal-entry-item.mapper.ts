import type { JournalEntryItem, JournalLineItem } from '@personal-erp/contracts';
import type {
  AuditActorType,
  JournalEntrySourceKind,
  JournalEntryStatus
} from '@prisma/client';

type JournalLineRecord = {
  id: string;
  lineNumber: number;
  debitAmount: number;
  creditAmount: number;
  description: string | null;
  accountSubject: {
    code: string;
    name: string;
  };
  fundingAccount: {
    name: string;
  } | null;
};

type JournalEntryRecord = {
  id: string;
  entryNumber: string;
  entryDate: Date;
  status: JournalEntryStatus;
  sourceKind: JournalEntrySourceKind;
  memo: string | null;
  createdByActorType: AuditActorType;
  sourceCollectedTransaction: {
    id: string;
    title: string;
  } | null;
  lines: JournalLineRecord[];
};

export function mapJournalEntryRecordToItem(
  record: JournalEntryRecord
): JournalEntryItem {
  return {
    id: record.id,
    entryNumber: record.entryNumber,
    entryDate: record.entryDate.toISOString(),
    status: record.status,
    sourceKind: record.sourceKind,
    memo: record.memo,
    sourceCollectedTransactionId: record.sourceCollectedTransaction?.id ?? null,
    sourceCollectedTransactionTitle:
      record.sourceCollectedTransaction?.title ?? null,
    lines: record.lines.map(mapJournalLineRecordToItem)
  };
}

function mapJournalLineRecordToItem(record: JournalLineRecord): JournalLineItem {
  return {
    id: record.id,
    lineNumber: record.lineNumber,
    accountSubjectCode: record.accountSubject.code,
    accountSubjectName: record.accountSubject.name,
    fundingAccountName: record.fundingAccount?.name ?? null,
    debitAmount: record.debitAmount,
    creditAmount: record.creditAmount,
    description: record.description
  };
}
