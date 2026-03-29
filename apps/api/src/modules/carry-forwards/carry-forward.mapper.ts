import type { CarryForwardRecordItem } from '@personal-erp/contracts';
import type { AuditActorType } from '@prisma/client';

type CarryForwardRecord = {
  id: string;
  fromPeriodId: string;
  toPeriodId: string;
  sourceClosingSnapshotId: string;
  createdJournalEntryId: string | null;
  createdAt: Date;
  createdByActorType: AuditActorType;
  createdByMembershipId: string | null;
};

export function mapCarryForwardRecordToItem(
  record: CarryForwardRecord
): CarryForwardRecordItem {
  return {
    id: record.id,
    fromPeriodId: record.fromPeriodId,
    toPeriodId: record.toPeriodId,
    sourceClosingSnapshotId: record.sourceClosingSnapshotId,
    createdJournalEntryId: record.createdJournalEntryId,
    createdAt: record.createdAt.toISOString(),
    createdByActorType: record.createdByActorType,
    createdByMembershipId: record.createdByMembershipId
  };
}
