import type {
  ClosingSnapshotItem,
  ClosingSnapshotLineItem
} from '@personal-erp/contracts';

type ClosingSnapshotLineRecord = {
  id: string;
  balanceAmount: number;
  accountSubjectCode: string;
  accountSubjectName: string;
  fundingAccountName: string | null;
};

type ClosingSnapshotRecord = {
  id: string;
  periodId: string;
  lockedAt: Date;
  totalAssetAmount: number;
  totalLiabilityAmount: number;
  totalEquityAmount: number;
  periodPnLAmount: number;
  lines: ClosingSnapshotLineRecord[];
};

export function mapClosingSnapshotRecordToItem(
  record: ClosingSnapshotRecord
): ClosingSnapshotItem {
  return {
    id: record.id,
    periodId: record.periodId,
    lockedAt: record.lockedAt.toISOString(),
    totalAssetAmount: record.totalAssetAmount,
    totalLiabilityAmount: record.totalLiabilityAmount,
    totalEquityAmount: record.totalEquityAmount,
    periodPnLAmount: record.periodPnLAmount,
    lines: record.lines.map(mapClosingSnapshotLineRecordToItem)
  };
}

function mapClosingSnapshotLineRecordToItem(
  record: ClosingSnapshotLineRecord
): ClosingSnapshotLineItem {
  return {
    id: record.id,
    accountSubjectCode: record.accountSubjectCode,
    accountSubjectName: record.accountSubjectName,
    fundingAccountName: record.fundingAccountName,
    balanceAmount: record.balanceAmount
  };
}
