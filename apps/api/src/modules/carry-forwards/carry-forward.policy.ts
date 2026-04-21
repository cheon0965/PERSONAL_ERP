import { ConflictException } from '@nestjs/common';
import type {
  AccountSubjectKind,
  AccountingPeriodStatus,
  OpeningBalanceSourceKind
} from '@prisma/client';

export function readNextMonth(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    year: nextYear,
    month: nextMonth,
    monthLabel: `${nextYear}-${String(nextMonth).padStart(2, '0')}`
  };
}

export function readPeriodBoundary(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate =
    month === 12
      ? new Date(Date.UTC(year + 1, 0, 1))
      : new Date(Date.UTC(year, month, 1));

  return {
    startDate,
    endDate
  };
}

export function isCarryForwardAccount(subjectKind: AccountSubjectKind) {
  return (
    subjectKind === 'ASSET' ||
    subjectKind === 'LIABILITY' ||
    subjectKind === 'EQUITY'
  );
}

export function assertCarryForwardCanBeCanceled(input: {
  targetPeriodStatus: AccountingPeriodStatus;
  targetOpeningBalanceSourceKind: OpeningBalanceSourceKind | null;
  createdJournalEntryId: string | null;
  targetUsageCounts: {
    collectedTransactions: number;
    importBatches: number;
    journalEntries: number;
    financialStatementSnapshots: number;
    closingSnapshots: number;
  };
}) {
  if (input.createdJournalEntryId) {
    throw new ConflictException(
      '차기 이월 전표가 이미 생성되어 취소할 수 없습니다.'
    );
  }

  if (input.targetPeriodStatus !== 'OPEN') {
    throw new ConflictException(
      '다음 운영 기간이 진행 또는 잠금 단계라 차기 이월을 취소할 수 없습니다.'
    );
  }

  if (input.targetOpeningBalanceSourceKind !== 'CARRY_FORWARD') {
    throw new ConflictException(
      '다음 운영 기간의 오프닝 잔액 출처가 차기 이월이 아니어서 취소할 수 없습니다.'
    );
  }

  const hasTargetUsage =
    input.targetUsageCounts.collectedTransactions > 0 ||
    input.targetUsageCounts.importBatches > 0 ||
    input.targetUsageCounts.journalEntries > 0 ||
    input.targetUsageCounts.financialStatementSnapshots > 0 ||
    input.targetUsageCounts.closingSnapshots > 0;

  if (hasTargetUsage) {
    throw new ConflictException(
      '다음 운영 기간에 거래, 업로드, 전표, 마감 산출물이 있어 차기 이월을 취소할 수 없습니다.'
    );
  }
}
