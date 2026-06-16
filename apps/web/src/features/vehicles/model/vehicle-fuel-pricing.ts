export type FuelPricingField = 'liters' | 'amountWon' | 'unitPriceWon';

export type FuelPricingValues = Record<FuelPricingField, unknown>;

const fuelPricingFields: FuelPricingField[] = [
  'liters',
  'amountWon',
  'unitPriceWon'
];
const fuelLitersPrecision = 3;

export function recordFuelPricingFieldEdit(
  currentOrder: readonly FuelPricingField[],
  field: FuelPricingField
): FuelPricingField[] {
  return [...currentOrder.filter((current) => current !== field), field].slice(
    -2
  );
}

export function calculateFuelPricingAdjustment(input: {
  values: FuelPricingValues;
  editOrder: readonly FuelPricingField[];
}): { field: FuelPricingField; value: number } | null {
  const targetField = resolveFuelPricingTargetField(
    input.editOrder,
    input.values
  );

  if (!targetField) {
    return null;
  }

  const nextValue = calculateFuelPricingFieldValue(targetField, input.values);

  if (nextValue == null || isSameFuelPricingValue(targetField, input.values)) {
    return null;
  }

  return {
    field: targetField,
    value: nextValue
  };
}

function resolveFuelPricingTargetField(
  editOrder: readonly FuelPricingField[],
  values: FuelPricingValues
): FuelPricingField | null {
  const latestTwoFields = editOrder.slice(-2);

  if (latestTwoFields.length >= 2) {
    return (
      fuelPricingFields.find((field) => !latestTwoFields.includes(field)) ??
      null
    );
  }

  const latestField = latestTwoFields[0];
  if (!latestField) {
    return null;
  }

  const liters = readPositiveNumber(values.liters);
  const amountWon = readPositiveNumber(values.amountWon);
  const unitPriceWon = readPositiveNumber(values.unitPriceWon);

  switch (latestField) {
    case 'liters':
      return unitPriceWon != null
        ? 'amountWon'
        : amountWon != null
          ? 'unitPriceWon'
          : null;
    case 'amountWon':
      return liters != null
        ? 'unitPriceWon'
        : unitPriceWon != null
          ? 'liters'
          : null;
    case 'unitPriceWon':
      return liters != null ? 'amountWon' : amountWon != null ? 'liters' : null;
  }
}

function calculateFuelPricingFieldValue(
  field: FuelPricingField,
  values: FuelPricingValues
) {
  const liters = readPositiveNumber(values.liters);
  const amountWon = readPositiveNumber(values.amountWon);
  const unitPriceWon = readPositiveNumber(values.unitPriceWon);

  switch (field) {
    case 'liters':
      return amountWon != null && unitPriceWon != null
        ? roundFuelLiters(amountWon / unitPriceWon)
        : null;
    case 'amountWon':
      return liters != null && unitPriceWon != null
        ? Math.round(liters * unitPriceWon)
        : null;
    case 'unitPriceWon':
      return amountWon != null && liters != null
        ? Math.round(amountWon / liters)
        : null;
  }
}

function isSameFuelPricingValue(
  field: FuelPricingField,
  values: FuelPricingValues
) {
  const currentValue = readPositiveNumber(values[field]);
  const nextValue = calculateFuelPricingFieldValue(field, values);

  if (currentValue == null || nextValue == null) {
    return false;
  }

  if (field === 'liters') {
    return Math.abs(currentValue - nextValue) < 1 / 10 ** fuelLitersPrecision;
  }

  return Math.round(currentValue) === nextValue;
}

function readPositiveNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function roundFuelLiters(value: number) {
  return Number(value.toFixed(fuelLitersPrecision));
}
