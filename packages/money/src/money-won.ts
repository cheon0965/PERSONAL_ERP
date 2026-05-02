import { Decimal } from 'decimal.js';

export type MoneyWon = number;
export type MoneyAllocationWeight = number | string;

export type ParseMoneyWonOptions = {
  allowString?: boolean;
  allowThousandsSeparator?: boolean;
  min?: number;
  max?: number;
};

export const MAX_MONEY_WON = Number.MAX_SAFE_INTEGER;
export const MIN_MONEY_WON = Number.MIN_SAFE_INTEGER;

const DEFAULT_PARSE_OPTIONS: Required<
  Pick<ParseMoneyWonOptions, 'allowString' | 'allowThousandsSeparator'>
> = {
  allowString: true,
  allowThousandsSeparator: true
};

export function isMoneyWon(value: unknown): value is MoneyWon {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function isPositiveMoneyWon(value: unknown): value is MoneyWon {
  return isMoneyWon(value) && value > 0;
}

export function isNonNegativeMoneyWon(value: unknown): value is MoneyWon {
  return isMoneyWon(value) && value >= 0;
}

export function parseMoneyWon(
  value: unknown,
  options?: ParseMoneyWonOptions
): MoneyWon | null {
  // 외부 입력은 number와 문자열을 모두 받을 수 있지만, 최종 MoneyWon은 항상
  // 값은 `Number.MAX_SAFE_INTEGER` 범위 안의 정수로만 통과시킨다.
  const resolvedOptions = {
    ...DEFAULT_PARSE_OPTIONS,
    ...options
  };

  if (typeof value === 'number') {
    return coerceValidatedNumber(value, resolvedOptions);
  }

  if (!resolvedOptions.allowString || typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeIntegerToken(
    value,
    resolvedOptions.allowThousandsSeparator
  );
  if (!normalized) {
    return null;
  }

  const parsed = bigintToMoneyWon(BigInt(normalized), resolvedOptions);
  return parsed;
}

export function asMoneyWon(
  value: number,
  options?: Omit<ParseMoneyWonOptions, 'allowString'>
): MoneyWon {
  const parsed = parseMoneyWon(value, {
    allowString: false,
    ...options
  });
  if (parsed == null) {
    throw new RangeError('Value is not a safe money integer.');
  }

  return parsed;
}

export function assertMoneyWon(
  value: unknown,
  options?: ParseMoneyWonOptions
): asserts value is MoneyWon {
  if (parseMoneyWon(value, options) == null) {
    throw new RangeError('Value is not a safe money integer.');
  }
}

export function addMoneyWon(left: number, right: number): MoneyWon {
  // 금액 덧셈은 JS number 직접 연산 대신 BigInt를 거쳐 안전 정수 범위 초과를 감지한다.
  return coerceBigintToMoneyWonOrThrow(
    BigInt(asMoneyWon(left)) + BigInt(asMoneyWon(right))
  );
}

export function subtractMoneyWon(left: number, right: number): MoneyWon {
  return coerceBigintToMoneyWonOrThrow(
    BigInt(asMoneyWon(left)) - BigInt(asMoneyWon(right))
  );
}

export function sumMoneyWon(values: Iterable<number>): MoneyWon {
  let total = 0n;

  for (const value of values) {
    total += BigInt(asMoneyWon(value));
  }

  return coerceBigintToMoneyWonOrThrow(total);
}

export function compareMoneyWon(left: number, right: number) {
  const normalizedLeft = asMoneyWon(left);
  const normalizedRight = asMoneyWon(right);

  if (normalizedLeft === normalizedRight) {
    return 0;
  }

  return normalizedLeft < normalizedRight ? -1 : 1;
}

export function roundMoneyWonHalfUp(value: number | string): MoneyWon {
  return decimalToMoneyWonOrThrow(
    parseDecimal(value, 'Value cannot be rounded to MoneyWon.').toDecimalPlaces(
      0,
      Decimal.ROUND_HALF_UP
    )
  );
}

export function allocateMoneyWon(
  total: number,
  weights: readonly MoneyAllocationWeight[],
  options?: {
    remainderIndex?: number;
  }
): MoneyWon[] {
  // 배분은 원 단위 절사 후 남은 잔차를 한 항목에 몰아 총합이 원금과 정확히 같도록 보정한다.
  // 세금/수수료 배분처럼 1원 오차가 누적되면 안 되는 곳에서 이 함수를 사용한다.
  if (weights.length === 0) {
    return [];
  }

  const normalizedTotal = asMoneyWon(total);
  const sign = normalizedTotal < 0 ? -1 : 1;
  const absoluteTotal = new Decimal(normalizedTotal.toString()).abs();
  const normalizedWeights = weights.map(parseNonNegativeWeight);
  const totalWeight = normalizedWeights.reduce(
    (sum, weight) => sum.plus(weight),
    new Decimal(0)
  );

  if (totalWeight.isZero()) {
    return weights.map(() => asMoneyWon(0));
  }

  const allocations = normalizedWeights.map((weight) =>
    absoluteTotal.times(weight).div(totalWeight).floor()
  );
  const allocatedSum = allocations.reduce(
    (sum, value) => sum.plus(value),
    new Decimal(0)
  );
  const remainder = absoluteTotal.minus(allocatedSum);
  const remainderIndex =
    options?.remainderIndex ?? resolveDefaultRemainderIndex(normalizedWeights);

  if (
    options?.remainderIndex != null &&
    (!Number.isInteger(options.remainderIndex) ||
      options.remainderIndex < 0 ||
      options.remainderIndex >= weights.length)
  ) {
    throw new RangeError(
      'Allocation remainderIndex must reference an existing weight.'
    );
  }

  if (remainderIndex >= 0) {
    allocations[remainderIndex] = (
      allocations[remainderIndex] ?? new Decimal(0)
    ).plus(remainder);
  }

  return allocations.map((allocation) =>
    decimalToMoneyWonOrThrow(allocation.times(sign))
  );
}

export function toMoneyWonNumber(value: MoneyWon): number {
  return value;
}

function coerceValidatedNumber(
  value: number,
  options: ParseMoneyWonOptions
): MoneyWon | null {
  if (!Number.isSafeInteger(value)) {
    return null;
  }

  if (options.min != null && value < options.min) {
    return null;
  }

  if (options.max != null && value > options.max) {
    return null;
  }

  return value;
}

function normalizeIntegerToken(
  value: string,
  allowThousandsSeparator: boolean
): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalized = allowThousandsSeparator
    ? trimmed.replace(/,/g, '')
    : trimmed;
  return /^[-+]?\d+$/.test(normalized) ? normalized : null;
}

function bigintToMoneyWon(
  value: bigint,
  options?: Pick<ParseMoneyWonOptions, 'min' | 'max'>
): MoneyWon | null {
  const min = BigInt(options?.min ?? MIN_MONEY_WON);
  const max = BigInt(options?.max ?? MAX_MONEY_WON);

  if (value < min || value > max) {
    return null;
  }

  const asNumber = Number(value);
  return Number.isSafeInteger(asNumber) ? asNumber : null;
}

function coerceBigintToMoneyWonOrThrow(
  value: bigint,
  options?: Pick<ParseMoneyWonOptions, 'min' | 'max'>
): MoneyWon {
  const parsed = bigintToMoneyWon(value, options);
  if (parsed == null) {
    throw new RangeError('MoneyWon value exceeds the safe integer range.');
  }

  return parsed;
}

function parseDecimal(value: number | string, errorMessage: string) {
  const normalized =
    typeof value === 'string' ? normalizeDecimalToken(value) : value;

  if (normalized == null) {
    throw new RangeError(errorMessage);
  }

  try {
    const decimal = new Decimal(normalized);
    if (!decimal.isFinite()) {
      throw new RangeError(errorMessage);
    }

    return decimal;
  } catch {
    throw new RangeError(errorMessage);
  }
}

function normalizeDecimalToken(value: string) {
  const normalized = value.trim().replace(/,/g, '');
  if (normalized.length === 0) {
    return null;
  }

  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized) ? normalized : null;
}

function decimalToMoneyWonOrThrow(
  value: Decimal,
  options?: Pick<ParseMoneyWonOptions, 'min' | 'max'>
): MoneyWon {
  if (!value.isInteger()) {
    throw new RangeError('MoneyWon value must be an integer.');
  }

  const parsed = bigintToMoneyWon(BigInt(value.toFixed(0)), options);
  if (parsed == null) {
    throw new RangeError('MoneyWon value exceeds the safe integer range.');
  }

  return parsed;
}

function parseNonNegativeWeight(value: MoneyAllocationWeight) {
  const weight = parseDecimal(
    value,
    'Allocation weights must be finite non-negative decimal values.'
  );

  if (weight.isNegative()) {
    throw new RangeError(
      'Allocation weights must be finite non-negative decimal values.'
    );
  }

  return weight;
}

function resolveDefaultRemainderIndex(weights: readonly Decimal[]) {
  for (let index = weights.length - 1; index >= 0; index -= 1) {
    if ((weights[index] ?? new Decimal(0)).greaterThan(0)) {
      return index;
    }
  }

  return -1;
}
