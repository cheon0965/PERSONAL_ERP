import type {
  FinancialStatementPayload,
  FinancialStatementSnapshotItem
} from '@personal-erp/contracts';
import type { FinancialStatementKind, Prisma } from '@prisma/client';

type FinancialStatementSnapshotRecord = {
  id: string;
  periodId: string;
  statementKind: FinancialStatementKind;
  currency: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
  period: {
    year: number;
    month: number;
  };
};

export function mapFinancialStatementSnapshotRecordToItem(
  record: FinancialStatementSnapshotRecord
): FinancialStatementSnapshotItem {
  return {
    id: record.id,
    periodId: record.periodId,
    monthLabel: `${record.period.year}-${String(record.period.month).padStart(2, '0')}`,
    statementKind: record.statementKind,
    currency: record.currency,
    payload: record.payload as FinancialStatementPayload,
    createdAt: record.createdAt.toISOString()
  };
}
