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
  const latestPeriod = findLatestAccountingPeriod(input.periods);
  const carryForwardRecordId =
    input.carryForwardView?.carryForwardRecord.id ?? null;
  const nextOpeningBalanceSourceKind =
    nextPeriod?.openingBalanceSourceKind ?? null;

  if (latestPeriod && latestPeriod.id !== input.period.id) {
    return {
      periodId: input.period.id,
      isReady: true,
      canReopen: false,
      statusLabel: '최신 월 아님',
      statusSeverity: 'warning',
      detailLines: [
        `최근 운영 월 ${latestPeriod.monthLabel}이 이미 존재해 ${input.period.monthLabel}은 재오픈할 수 없습니다. 운영 중에는 하나의 최신 진행월만 열어 둡니다.`
      ],
      carryForwardRecordId,
      nextPeriodId: nextPeriod?.id ?? null,
      nextPeriodMonthLabel: nextPeriod?.monthLabel ?? null,
      nextOpeningBalanceSourceKind
    };
  }

  if (input.carryForwardError) {
    return {
      periodId: input.period.id,
      isReady: false,
      canReopen: false,
      statusLabel: '조건 확인 실패',
      statusSeverity: 'error',
      detailLines: [
        readReopenEligibilityErrorMessage(
          input.carryForwardError,
          '차기 이월 상태를 확인하지 못했습니다.'
        )
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
        '최신 월 여부, 차기 이월, 다음 월 오프닝 스냅샷 상태를 확인하고 있습니다.'
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
        '가장 최근 운영 월이며 차기 이월과 다음 월 오프닝 스냅샷 종속성이 없어 재오픈할 수 있습니다.'
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

function findLatestAccountingPeriod(periods: AccountingPeriodItem[]) {
  return periods.reduce<AccountingPeriodItem | null>((latest, period) => {
    if (!latest) {
      return period;
    }

    if (
      period.year > latest.year ||
      (period.year === latest.year && period.month > latest.month)
    ) {
      return period;
    }

    return latest;
  }, null);
}

function readReopenEligibilityErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
  if (
    error &&
    typeof error === 'object' &&
    'userMessage' in error &&
    typeof error.userMessage === 'string' &&
    error.userMessage.trim()
  ) {
    return error.userMessage.trim();
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (containsKorean(message) && !looksInternalMessage(message)) {
      return message;
    }
  }

  return fallbackMessage;
}

function containsKorean(message: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(message);
}

function looksInternalMessage(message: string) {
  return (
    message.includes('[personal-erp]') ||
    message.includes('Prisma') ||
    message.includes('NEXT_PUBLIC_') ||
    message.includes('<PERSONAL_ERP_SECRET_DIR>') ||
    /^Request failed/i.test(message) ||
    /^Cannot /i.test(message) ||
    /^Could not /i.test(message)
  );
}
