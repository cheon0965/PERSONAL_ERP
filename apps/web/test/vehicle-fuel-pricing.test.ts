import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFuelPricingAdjustment,
  recordFuelPricingFieldEdit
} from '../src/features/vehicles/vehicle-fuel-pricing';

test('vehicle fuel pricing calculates unit price from liters and amount', () => {
  const editOrder = recordFuelPricingFieldEdit(
    recordFuelPricingFieldEdit([], 'liters'),
    'amountWon'
  );

  assert.deepEqual(
    calculateFuelPricingAdjustment({
      values: {
        liters: '44.2',
        amountWon: '76431',
        unitPriceWon: ''
      },
      editOrder
    }),
    {
      field: 'unitPriceWon',
      value: 1729
    }
  );
});

test('vehicle fuel pricing calculates amount from liters and unit price', () => {
  const editOrder = recordFuelPricingFieldEdit(
    recordFuelPricingFieldEdit([], 'liters'),
    'unitPriceWon'
  );

  assert.deepEqual(
    calculateFuelPricingAdjustment({
      values: {
        liters: '44.2',
        amountWon: '',
        unitPriceWon: '1729'
      },
      editOrder
    }),
    {
      field: 'amountWon',
      value: 76422
    }
  );
});

test('vehicle fuel pricing calculates liters from amount and unit price', () => {
  const editOrder = recordFuelPricingFieldEdit(
    recordFuelPricingFieldEdit([], 'amountWon'),
    'unitPriceWon'
  );

  assert.deepEqual(
    calculateFuelPricingAdjustment({
      values: {
        liters: '',
        amountWon: '76431',
        unitPriceWon: '1729'
      },
      editOrder
    }),
    {
      field: 'liters',
      value: 44.205
    }
  );
});

test('vehicle fuel pricing recalculates unit price when amount changes first on an existing log', () => {
  const editOrder = recordFuelPricingFieldEdit([], 'amountWon');

  assert.deepEqual(
    calculateFuelPricingAdjustment({
      values: {
        liters: 44.2,
        amountWon: 81234,
        unitPriceWon: 1729
      },
      editOrder
    }),
    {
      field: 'unitPriceWon',
      value: 1838
    }
  );
});

test('vehicle fuel pricing leaves already aligned values untouched', () => {
  const editOrder = recordFuelPricingFieldEdit(
    recordFuelPricingFieldEdit([], 'liters'),
    'amountWon'
  );

  assert.equal(
    calculateFuelPricingAdjustment({
      values: {
        liters: 44.2,
        amountWon: 76431,
        unitPriceWon: 1729
      },
      editOrder
    }),
    null
  );
});
