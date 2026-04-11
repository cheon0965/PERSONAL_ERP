import {
  addMoneyWon,
  isMoneyWon,
  parseMoneyWon,
  sumMoneyWon
} from '@personal-erp/money';
import { z } from 'zod';

const SAFE_INTEGER_MONEY_MESSAGE = '금액은 안전한 정수여야 합니다.';

export function createPositiveMoneyWonSchema(message: string) {
  return z.coerce
    .number()
    .refine(isMoneyWon, SAFE_INTEGER_MONEY_MESSAGE)
    .refine((value) => value > 0, message);
}

export function createNonNegativeMoneyWonSchema(message: string) {
  return z.coerce
    .number()
    .refine(isMoneyWon, SAFE_INTEGER_MONEY_MESSAGE)
    .refine((value) => value >= 0, message);
}

export function createPositiveMoneyWonTextSchema(message: string) {
  return z.string().trim().refine((value) => {
    const parsed = parseMoneyWon(value);
    return parsed != null && parsed > 0;
  }, message);
}

export function parseMoneyWonValue(value: unknown) {
  return parseMoneyWon(value) ?? 0;
}

export function sumMoneyWonValues(values: Iterable<number>) {
  return sumMoneyWon(values);
}

export function addMoneyWonValues(left: number, right: number) {
  return addMoneyWon(left, right);
}
