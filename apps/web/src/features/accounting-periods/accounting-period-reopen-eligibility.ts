import type {
  AccountingPeriodItem,
  CarryForwardView,
  OpeningBalanceSourceKind
} from '@personal-erp/contracts';

export type AccountingPeriodReopenEligibility = {
  periodId: string;
  isReady: boolean;
  canReopen: boolean;
  statusLabel: string;
  statusSeverity: 'success' | 'info' | 'warning' | 'error';
  detailLines: string[];
  carryForwardRecordId: string | null;
  nextPeriodId: string | null;
  nextPeriodMonthLabel: string | null;
  nextOpeningBalanceSourceKind: OpeningBalanceSourceKind | null;
};

export function buildAccountingPeriodReopenEligibility(input: {
  period: AccountingPeriodItem;
  periods: AccountingPeriodItem[];
  carryForwardView: CarryForwardView | null;
  carryForwardError: unknown;
  carryForwardPending: boolean;
}): AccountingPeriodReopenEligibility {
  const nextPeriod = findNextAccountingPeriod(input.period, input.periods);
  const carryForwardRecordId =
    input.carryForwardView?.carryForwardRecord.id ?? null;
  const nextOpeningBalanceSourceKind =
    nextPeriod?.openingBalanceSourceKind ?? null;

  if (input.carryForwardError) {
    return {
      periodId: input.period.id,
      isReady: false,
      canReopen: false,
      statusLabel: '조건 확인 실패',
      statusSeverity: 'error',
      detailLines: [
        input.carryForwardError instanceof Error
          ? input.carryForwardError.message
          : '차기 이월 상태를 확인하지 못했습니다.'
      ],
      carryForwardRecordId,
      nextPeriodId: nextPeriod?.id ?? null,
      nextPeriodMonthLabel: nextPeriod?.monthLabel ?? null,
      nextOpeningBalanceSourceKind
    };
  }

  if (input.carryForwardPending) {
    return {
      periodId: input.period.id,
      isReady: false,
      canReopen: false,
      statusLabel: '조건 확인 중',
      statusSeverity: 'info',
      detailLines: [
        '차기 이월과 다음 월 오프닝 스냅샷 상태를 확인하고 있습니다.'
      ],
      carryForwardRecordId,
      nextPeriodId: nextPeriod?.id ?? null,
      nextPeriodMonthLabel: nextPeriod?.monthLabel ?? null,
      nextOpeningBalanceSourceKind
    };
  }

  const blockingReasons = readReopenBlockingReasons({
    carryForwardRecordId,
    nextPeriod
  });

  if (blockingReasons.length === 0) {
    return {
      periodId: input.period.id,
      isReady: true,
      canReopen: true,
      statusLabel: '재오픈 가능',
      statusSeverity: 'success',
      detailLines: [
        '차기 이월과 다음 월 오프닝 스냅샷 종속성이 없어 재오픈할 수 있습니다.'
      ],
      carryForwardRecordId,
      nextPeriodId: nextPeriod?.id ?? null,
      nextPeriodMonthLabel: nextPeriod?.monthLabel ?? null,
      nextOpeningBalanceSourceKind
    };
  }

  return {
    periodId: input.period.id,
    isReady: true,
    canReopen: false,
    statusLabel: readBlockedStatusLabel({
      carryForwardRecordId,
      nextOpeningBalanceSourceKind
    }),
    statusSeverity: 'warning',
    detailLines: blockingReasons,
    carryForwardRecordId,
    nextPeriodId: nextPeriod?.id ?? null,
    nextPeriodMonthLabel: nextPeriod?.monthLabel ?? null,
    nextOpeningBalanceSourceKind
  };
}

function readReopenBlockingReasons(input: {
  carryForwardRecordId: string | null;
  nextPeriod: AccountingPeriodItem | null;
}) {
  const reasons: string[] = [];

  if (input.carryForwardRecordId) {
    reasons.push('차기 이월이 이미 생성되어 재오픈할 수 없습니다.');
  }

  if (input.nextPeriod?.openingBalanceSourceKind) {
    reasons.push(
      `다음 운영 기간(${input.nextPeriod.monthLabel})에 ${readOpeningBalanceSourceLabel(input.nextPeriod.openingBalanceSourceKind)} 오프닝 스냅샷이 이미 있어 재오픈할 수 없습니다.`
    );
  }

  return reasons;
}

function readBlockedStatusLabel(input: {
  carryForwardRecordId: string | null;
  nextOpeningBalanceSourceKind: OpeningBalanceSourceKind | null;
}) {
  if (input.carryForwardRecordId && input.nextOpeningBalanceSourceKind) {
    return '차기 이월 + 오프닝 차단';
  }

  if (input.carryForwardRecordId) {
    return '차기 이월 생성됨';
  }

  if (input.nextOpeningBalanceSourceKind) {
    return '오프닝 스냅샷 있음';
  }

  return '재오픈 검토';
}

function readOpeningBalanceSourceLabel(sourceKind: OpeningBalanceSourceKind) {
  return sourceKind === 'CARRY_FORWARD' ? '차기 이월 기준' : '초기 설정';
}

function findNextAccountingPeriod(
  period: AccountingPeriodItem,
  periods: AccountingPeriodItem[]
) {
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const nextMonth = period.month === 12 ? 1 : period.month + 1;

  return (
    periods.find(
      (candidate) =>
        candidate.year === nextYear && candidate.month === nextMonth
    ) ?? null
  );
}
