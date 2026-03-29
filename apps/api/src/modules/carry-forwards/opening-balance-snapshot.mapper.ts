import type {
  OpeningBalanceSnapshotItem,
  OpeningBalanceSnapshotLineItem
} from '@personal-erp/contracts';
import type { OpeningBalanceSourceKind } from '@prisma/client';

type OpeningBalanceSnapshotLineRecord = {
  id: string;
  balanceAmount: number;
  accountSubjectCode: string;
  accountSubjectName: string;
  fundingAccountName: string | null;
};

type OpeningBalanceSnapshotRecord = {
  id: string;
  effectivePeriodId: string;
  sourceKind: OpeningBalanceSourceKind;
  createdAt: Date;
  lines: OpeningBalanceSnapshotLineRecord[];
};

export function mapOpeningBalanceSnapshotRecordToItem(
  record: OpeningBalanceSnapshotRecord
): OpeningBalanceSnapshotItem {
  return {
    id: record.id,
    effectivePeriodId: record.effectivePeriodId,
    sourceKind: record.sourceKind,
    createdAt: record.createdAt.toISOString(),
    lines: record.lines.map(mapOpeningBalanceSnapshotLineRecordToItem)
  };
}

function mapOpeningBalanceSnapshotLineRecordToItem(
  record: OpeningBalanceSnapshotLineRecord
): OpeningBalanceSnapshotLineItem {
  return {
    id: record.id,
    accountSubjectCode: record.accountSubjectCode,
    accountSubjectName: record.accountSubjectName,
    fundingAccountName: record.fundingAccountName,
    balanceAmount: record.balanceAmount
  };
}
