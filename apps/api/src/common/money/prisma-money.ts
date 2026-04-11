import { asMoneyWon, parseMoneyWon, type MoneyWon } from '@personal-erp/money';
import { Prisma } from '@prisma/client';

export type PrismaMoneyLike = number | string | Prisma.Decimal;

export function fromPrismaMoneyWon(value: PrismaMoneyLike): MoneyWon {
  const parsed =
    typeof value === 'number'
      ? parseMoneyWon(value, { allowString: false })
      : parseMoneyWon(value.toString(), {
          allowThousandsSeparator: false
        });

  if (parsed == null) {
    throw new RangeError('Prisma money value is not a safe integer.');
  }

  return parsed;
}

export function toPrismaMoneyWon(value: number): Prisma.Decimal {
  return new Prisma.Decimal(asMoneyWon(value).toString());
}
