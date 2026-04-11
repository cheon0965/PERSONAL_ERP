import type {
  ClosingSnapshotItem,
  ClosingSnapshotLineItem
} from '@personal-erp/contracts';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

type ClosingSnapshotLineRecord = {
  id: string;
  balanceAmount: PrismaMoneyLike;
  accountSubjectCode: string;
  accountSubjectName: string;
  fundingAccountName: string | null;
};

type ClosingSnapshotRecord = {
  id: string;
  periodId: string;
  lockedAt: Date;
  totalAssetAmount: PrismaMoneyLike;
  totalLiabilityAmount: PrismaMoneyLike;
  totalEquityAmount: PrismaMoneyLike;
  periodPnLAmount: PrismaMoneyLike;
  lines: ClosingSnapshotLineRecord[];
};

export function mapClosingSnapshotRecordToItem(
  record: ClosingSnapshotRecord
): ClosingSnapshotItem {
  return {
    id: record.id,
    periodId: record.periodId,
    lockedAt: record.lockedAt.toISOString(),
    totalAssetAmount: fromPrismaMoneyWon(record.totalAssetAmount),
    totalLiabilityAmount: fromPrismaMoneyWon(record.totalLiabilityAmount),
    totalEquityAmount: fromPrismaMoneyWon(record.totalEquityAmount),
    periodPnLAmount: fromPrismaMoneyWon(record.periodPnLAmount),
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
    balanceAmount: fromPrismaMoneyWon(record.balanceAmount)
  };
}
