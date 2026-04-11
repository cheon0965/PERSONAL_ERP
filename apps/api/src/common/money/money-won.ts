import { BadRequestException } from '@nestjs/common';
import {
  isMoneyWon,
  isNonNegativeMoneyWon,
  isPositiveMoneyWon
} from '@personal-erp/money';

export function requireMoneyWon(value: number, message: string) {
  if (!isMoneyWon(value)) {
    throw new BadRequestException(message);
  }

  return value;
}

export function requirePositiveMoneyWon(value: number, message: string) {
  if (!isPositiveMoneyWon(value)) {
    throw new BadRequestException(message);
  }

  return value;
}

export function requireNonNegativeMoneyWon(value: number, message: string) {
  if (!isNonNegativeMoneyWon(value)) {
    throw new BadRequestException(message);
  }

  return value;
}
