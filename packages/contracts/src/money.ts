/**
 * HTTP contract money value.
 *
 * MoneyWon is a KRW whole-won safe integer. API payloads keep `number` for the
 * first migration stage, while API persistence stores money as Decimal(19,0).
 * Decimal intermediate values must be rounded with HALF_UP before persistence.
 */
export type MoneyWon = number;
