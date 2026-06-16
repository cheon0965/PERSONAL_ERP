import { AccountingPeriodStatus } from '@prisma/client';

export type ReportingPeriodRecord = {
  id: string;
  year: number;
  month: number;
  status: AccountingPeriodStatus;
};

export function selectOperationalPeriod<T extends ReportingPeriodRecord>(
  periods: T[],
  periodId?: string,
  monthLabel?: string
): T | null {
  if (periodId) {
    return periods.find((period) => period.id === periodId) ?? null;
  }

  if (monthLabel) {
    return (
      periods.find(
        (period) =>
          `${period.year}-${String(period.month).padStart(2, '0')}` ===
          monthLabel
      ) ?? null
    );
  }

  return (
    periods.find((period) => period.status !== AccountingPeriodStatus.LOCKED) ??
    periods.find((period) => period.status === AccountingPeriodStatus.LOCKED) ??
    null
  );
}

export function findLatestLockedPeriod<T extends ReportingPeriodRecord>(
  periods: T[]
): T | null {
  return (
    periods.find((period) => period.status === AccountingPeriodStatus.LOCKED) ??
    null
  );
}

export function findPreviousLockedPeriod<T extends ReportingPeriodRecord>(
  periods: T[],
  currentPeriodId: string
): T | null {
  const currentIndex = periods.findIndex(
    (period) => period.id === currentPeriodId
  );
  if (currentIndex === -1) {
    return null;
  }

  for (let index = currentIndex + 1; index < periods.length; index += 1) {
    const candidate = periods[index];
    if (candidate?.status === AccountingPeriodStatus.LOCKED) {
      return candidate;
    }
  }

  return null;
}
