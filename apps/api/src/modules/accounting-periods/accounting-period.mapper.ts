import type {
  AccountingPeriodItem,
  PeriodStatusHistoryItem
} from '@personal-erp/contracts';
import type {
  AccountingPeriodStatus,
  AuditActorType,
  OpeningBalanceSourceKind
} from '@prisma/client';

type PeriodStatusHistoryRecord = {
  id: string;
  fromStatus: AccountingPeriodStatus | null;
  toStatus: AccountingPeriodStatus;
  reason: string | null;
  actorType: AuditActorType;
  actorMembershipId: string | null;
  changedAt: Date;
};

type AccountingPeriodRecord = {
  id: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: AccountingPeriodStatus;
  openedAt: Date;
  lockedAt: Date | null;
  openingBalanceSnapshot: {
    sourceKind: OpeningBalanceSourceKind;
  } | null;
  statusHistory: PeriodStatusHistoryRecord[];
};

export function mapAccountingPeriodRecordToItem(
  record: AccountingPeriodRecord
): AccountingPeriodItem {
  return {
    id: record.id,
    year: record.year,
    month: record.month,
    monthLabel: `${record.year}-${String(record.month).padStart(2, '0')}`,
    startDate: record.startDate.toISOString(),
    endDate: record.endDate.toISOString(),
    status: record.status,
    openedAt: record.openedAt.toISOString(),
    lockedAt: record.lockedAt?.toISOString() ?? null,
    hasOpeningBalanceSnapshot: Boolean(record.openingBalanceSnapshot),
    openingBalanceSourceKind: record.openingBalanceSnapshot?.sourceKind ?? null,
    statusHistory: record.statusHistory.map(mapPeriodStatusHistoryToItem)
  };
}

function mapPeriodStatusHistoryToItem(
  record: PeriodStatusHistoryRecord
): PeriodStatusHistoryItem {
  return {
    id: record.id,
    fromStatus: record.fromStatus,
    toStatus: record.toStatus,
    reason: record.reason,
    actorType: record.actorType,
    actorMembershipId: record.actorMembershipId,
    changedAt: record.changedAt.toISOString()
  };
}
