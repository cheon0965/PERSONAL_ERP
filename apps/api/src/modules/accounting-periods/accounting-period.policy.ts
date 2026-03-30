import { BadRequestException } from '@nestjs/common';

export function normalizeMonthToken(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException('month는 YYYY-MM 형식이어야 합니다.');
  }

  return trimmed;
}

export function normalizeOptionalText(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readYearMonth(monthToken: string): {
  year: number;
  month: number;
} {
  const [yearToken, monthTokenPart] = monthToken.split('-');
  const year = Number(yearToken);
  const month = Number(monthTokenPart);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new BadRequestException('month는 YYYY-MM 형식이어야 합니다.');
  }

  return { year, month };
}

export function compareYearMonth(
  leftYear: number,
  leftMonth: number,
  rightYear: number,
  rightMonth: number
): number {
  return leftYear === rightYear ? leftMonth - rightMonth : leftYear - rightYear;
}
