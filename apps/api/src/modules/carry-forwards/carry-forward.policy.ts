import type { AccountSubjectKind } from '@prisma/client';

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
