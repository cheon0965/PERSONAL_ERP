import type { AccountingPeriodItem } from '@personal-erp/contracts';

const collectingStatuses = new Set<AccountingPeriodItem['status']>([
  'OPEN',
  'IN_REVIEW',
  'CLOSING'
]);

const journalWritableStatuses = new Set<AccountingPeriodItem['status']>([
  'OPEN',
  'IN_REVIEW'
]);

export function readCollectingAccountingPeriods(
  periods: AccountingPeriodItem[]
) {
  return periods.filter((period) => collectingStatuses.has(period.status));
}

export function readJournalWritableAccountingPeriods(
  periods: AccountingPeriodItem[]
) {
  return periods.filter((period) => journalWritableStatuses.has(period.status));
}

export function resolvePreferredAccountingPeriod(
  currentPeriod: AccountingPeriodItem | null,
  periods: AccountingPeriodItem[]
) {
  if (currentPeriod && periods.some((period) => period.id === currentPeriod.id)) {
    return currentPeriod;
  }

  return periods[0] ?? null;
}

export function findAccountingPeriodForDate(
  periods: AccountingPeriodItem[],
  businessDate: string
) {
  return (
    periods.find((period) => isDateWithinAccountingPeriod(businessDate, period)) ??
    null
  );
}

export function isDateWithinAccountingPeriod(
  businessDate: string,
  period: AccountingPeriodItem | null
): boolean {
  if (!period) {
    return false;
  }

  const businessTime = Date.parse(`${businessDate}T00:00:00.000Z`);
  const startTime = Date.parse(period.startDate);
  const endTime = Date.parse(period.endDate);

  return businessTime >= startTime && businessTime < endTime;
}
