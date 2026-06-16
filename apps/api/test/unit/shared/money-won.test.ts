import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMoneyWon,
  allocateMoneyWon,
  parseMoneyWon,
  roundMoneyWonHalfUp,
  subtractMoneyWon,
  sumMoneyWon
} from '@personal-erp/money';

test('parseMoneyWon accepts comma-separated integer text', () => {
  assert.equal(parseMoneyWon('1,234,567'), 1234567);
});

test('sumMoneyWon and subtractMoneyWon keep money arithmetic in safe integer bounds', () => {
  const total = sumMoneyWon([1500000, 250000, -100000]);

  assert.equal(total, 1650000);
  assert.equal(subtractMoneyWon(total, 650000), 1000000);
});

test('roundMoneyWonHalfUp rounds decimal strings to nearest won', () => {
  assert.equal(roundMoneyWonHalfUp('1200.4'), 1200);
  assert.equal(roundMoneyWonHalfUp('1200.5'), 1201);
  assert.equal(roundMoneyWonHalfUp('-1200.5'), -1201);
  assert.equal(roundMoneyWonHalfUp('1,234.5'), 1235);
  assert.throws(() => roundMoneyWonHalfUp('Infinity'), /rounded/);
});

test('allocateMoneyWon preserves the original total with decimal weights', () => {
  assert.deepEqual(allocateMoneyWon(1000, [1, 1, 1]), [333, 333, 334]);
  assert.deepEqual(
    allocateMoneyWon(1000, ['0.1', '0.2', '0.7']),
    [100, 200, 700]
  );
  assert.deepEqual(allocateMoneyWon(-1000, [1, 1, 1]), [-333, -333, -334]);
  assert.deepEqual(
    allocateMoneyWon(1000, [1, 1, 1], { remainderIndex: 0 }),
    [334, 333, 333]
  );
  assert.throws(
    () => allocateMoneyWon(1000, [1, 1, 1], { remainderIndex: 3 }),
    /remainderIndex/
  );
});

test('addMoneyWon throws when the result exceeds the safe integer range', () => {
  assert.throws(
    () => addMoneyWon(Number.MAX_SAFE_INTEGER, 1),
    /safe integer range/
  );
});
