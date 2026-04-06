'use client';

import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { z } from 'zod';
import { getTodayDateInputValue } from '@/shared/lib/date-input';

export const transactionSchema = z.object({
  title: z.string().trim().min(2, '제목은 2자 이상이어야 합니다.'),
  amountWon: z.coerce.number().int().positive('금액은 0보다 커야 합니다.'),
  businessDate: z.string().min(1, '거래일을 입력해 주세요.'),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  accountId: z.string().min(1, '자금수단을 선택해 주세요.'),
  categoryId: z.string(),
  memo: z.string().max(500, '메모는 500자 이하여야 합니다.')
});

export type TransactionFormInput = z.infer<typeof transactionSchema>;

export function resolveInitialBusinessDate(
  currentPeriod: AccountingPeriodItem | null
): string {
  const today = getTodayDateInputValue();
  if (!currentPeriod) {
    return today;
  }

  if (isWithinPeriod(today, currentPeriod)) {
    return today;
  }

  return currentPeriod.startDate.slice(0, 10);
}

export function isWithinPeriod(
  businessDate: string,
  currentPeriod: AccountingPeriodItem | null
): boolean {
  if (!currentPeriod) {
    return false;
  }

  const businessTime = Date.parse(`${businessDate}T00:00:00.000Z`);
  const startTime = Date.parse(currentPeriod.startDate);
  const endTime = Date.parse(currentPeriod.endDate);

  return businessTime >= startTime && businessTime < endTime;
}
