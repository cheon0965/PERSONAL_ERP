import type {
  AccountingPeriodItem,
  PeriodStatusHistoryItem
} from '@personal-erp/contracts';
import type { AccountingPeriodRecord } from '../models/accounting-period-record';

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
  record: AccountingPeriodRecord['statusHistory'][number]
): PeriodStatusHistoryItem {
  return {
    id: record.id,
    fromStatus: record.fromStatus,
    toStatus: record.toStatus,
    eventType: record.eventType,
    reason: record.reason,
    actorType: record.actorType,
    actorMembershipId: record.actorMembershipId,
    changedAt: record.changedAt.toISOString()
  };
}
