import { CategoryKind, LedgerTransactionFlowKind } from '@prisma/client';

const MAX_OCCURRENCE_ITERATIONS = 400;

export function resolveLedgerTransactionTypeId(
  explicitType: {
    id: string;
    flowKind: LedgerTransactionFlowKind;
    isActive: boolean;
  } | null,
  categoryKind: CategoryKind | null,
  defaultTypeIdByFlow: Map<LedgerTransactionFlowKind, string>
) {
  if (explicitType?.isActive) {
    return explicitType.id;
  }

  switch (categoryKind) {
    case CategoryKind.INCOME:
      return defaultTypeIdByFlow.get(LedgerTransactionFlowKind.INCOME) ?? null;
    case CategoryKind.EXPENSE:
      return defaultTypeIdByFlow.get(LedgerTransactionFlowKind.EXPENSE) ?? null;
    case CategoryKind.TRANSFER:
      return (
        defaultTypeIdByFlow.get(LedgerTransactionFlowKind.TRANSFER) ?? null
      );
    default:
      return null;
  }
}

export function buildPlannedDates(
  rule: {
    startDate: Date;
    endDate: Date | null;
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    dayOfMonth: number | null;
  },
  periodStart: Date,
  periodEndExclusive: Date
) {
  switch (rule.frequency) {
    case 'WEEKLY':
      return buildWeeklyDates(rule, periodStart, periodEndExclusive);
    case 'MONTHLY':
      return buildMonthlyLikeDates(rule, periodStart, periodEndExclusive, 1);
    case 'QUARTERLY':
      return buildMonthlyLikeDates(rule, periodStart, periodEndExclusive, 3);
    case 'YEARLY':
      return buildMonthlyLikeDates(rule, periodStart, periodEndExclusive, 12);
    default:
      return [];
  }
}

function buildWeeklyDates(
  rule: {
    startDate: Date;
    endDate: Date | null;
  },
  periodStart: Date,
  periodEndExclusive: Date
) {
  const start = toUtcDateOnly(rule.startDate);
  const ruleEnd = rule.endDate ? toUtcDateOnly(rule.endDate) : null;
  const periodStartDay = toUtcDateOnly(periodStart);
  const periodEndDay = toUtcDateOnly(periodEndExclusive);
  const dates: Date[] = [];

  let cursor = start;
  for (
    let iteration = 0;
    iteration < MAX_OCCURRENCE_ITERATIONS && cursor < periodEndDay;
    iteration += 1
  ) {
    if (
      cursor >= periodStartDay &&
      cursor < periodEndDay &&
      (!ruleEnd || cursor <= ruleEnd)
    ) {
      dates.push(cursor);
    }

    cursor = addDays(cursor, 7);
  }

  return dates;
}

function buildMonthlyLikeDates(
  rule: {
    startDate: Date;
    endDate: Date | null;
    dayOfMonth: number | null;
  },
  periodStart: Date,
  periodEndExclusive: Date,
  monthInterval: number
) {
  const start = toUtcDateOnly(rule.startDate);
  const ruleEnd = rule.endDate ? toUtcDateOnly(rule.endDate) : null;
  const periodStartDay = toUtcDateOnly(periodStart);
  const periodEndDay = toUtcDateOnly(periodEndExclusive);
  const preferredDay = rule.dayOfMonth ?? start.getUTCDate();
  const dates: Date[] = [];

  let cursor = createMonthDate(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    preferredDay
  );
  if (cursor < start) {
    cursor = addMonths(cursor, monthInterval, preferredDay);
  }

  for (
    let iteration = 0;
    iteration < MAX_OCCURRENCE_ITERATIONS && cursor < periodEndDay;
    iteration += 1
  ) {
    if (
      cursor >= periodStartDay &&
      cursor < periodEndDay &&
      (!ruleEnd || cursor <= ruleEnd)
    ) {
      dates.push(cursor);
    }

    cursor = addMonths(cursor, monthInterval, preferredDay);
  }

  return dates;
}

function toUtcDateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMonths(value: Date, months: number, preferredDay: number) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + months;

  return createMonthDate(year, month, preferredDay);
}

function createMonthDate(year: number, month: number, preferredDay: number) {
  const cappedDay = Math.min(preferredDay, daysInMonth(year, month));
  return new Date(Date.UTC(year, month, cappedDay));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
