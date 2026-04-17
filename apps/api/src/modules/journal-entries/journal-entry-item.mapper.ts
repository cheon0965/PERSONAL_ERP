import type {
  JournalEntryItem,
  JournalLineItem
} from '@personal-erp/contracts';
import type {
  AuditActorType,
  JournalEntrySourceKind,
  JournalEntryStatus
} from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

export type JournalLineRecord = {
  id: string;
  lineNumber: number;
  debitAmount: PrismaMoneyLike;
  creditAmount: PrismaMoneyLike;
  description: string | null;
  accountSubject: {
    code: string;
    name: string;
  };
  fundingAccount: {
    name: string;
  } | null;
};

export type RelatedJournalEntryRecord = {
  id: string;
  entryNumber: string;
};

export type JournalEntryRecord = {
  id: string;
  entryNumber: string;
  entryDate: Date;
  status: JournalEntryStatus;
  sourceKind: JournalEntrySourceKind;
  memo: string | null;
  reversesJournalEntryId?: string | null;
  correctsJournalEntryId?: string | null;
  correctionReason?: string | null;
  createdByActorType: AuditActorType;
  createdByMembershipId?: string | null;
  sourceCollectedTransaction: {
    id: string;
    title: string;
  } | null;
  reversesJournalEntry?: RelatedJournalEntryRecord | null;
  reversedByJournalEntry?: RelatedJournalEntryRecord | null;
  correctsJournalEntry?: RelatedJournalEntryRecord | null;
  correctionEntries?: RelatedJournalEntryRecord[];
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
    reversesJournalEntryId:
      record.reversesJournalEntry?.id ?? record.reversesJournalEntryId ?? null,
    reversesJournalEntryNumber:
      record.reversesJournalEntry?.entryNumber ?? null,
    reversedByJournalEntryId: record.reversedByJournalEntry?.id ?? null,
    reversedByJournalEntryNumber:
      record.reversedByJournalEntry?.entryNumber ?? null,
    correctsJournalEntryId:
      record.correctsJournalEntry?.id ?? record.correctsJournalEntryId ?? null,
    correctsJournalEntryNumber:
      record.correctsJournalEntry?.entryNumber ?? null,
    correctionEntryIds: (record.correctionEntries ?? []).map(
      (entry) => entry.id
    ),
    correctionEntryNumbers: (record.correctionEntries ?? []).map(
      (entry) => entry.entryNumber
    ),
    correctionReason: record.correctionReason ?? null,
    createdByActorType: record.createdByActorType,
    createdByMembershipId: record.createdByMembershipId ?? null,
    lines: record.lines.map(mapJournalLineRecordToItem)
  };
}

function mapJournalLineRecordToItem(
  record: JournalLineRecord
): JournalLineItem {
  return {
    id: record.id,
    lineNumber: record.lineNumber,
    accountSubjectCode: record.accountSubject.code,
    accountSubjectName: record.accountSubject.name,
    fundingAccountName: record.fundingAccount?.name ?? null,
    debitAmount: fromPrismaMoneyWon(record.debitAmount),
    creditAmount: fromPrismaMoneyWon(record.creditAmount),
    description: record.description
  };
}
