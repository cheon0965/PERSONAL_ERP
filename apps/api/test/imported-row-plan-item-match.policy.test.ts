import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planItemMatchDateToleranceDays,
  resolvePlanItemAutoMatch
} from '../src/modules/import-batches/imported-row-plan-item-match.policy';

test('resolvePlanItemAutoMatch returns a unique match when one candidate survives the narrowing steps', () => {
  const result = resolvePlanItemAutoMatch({
    candidates: [
      {
        id: 'plan-1',
        plannedAmount: 19800,
        plannedDate: new Date('2026-03-11T00:00:00.000Z'),
        fundingAccountId: 'acc-1',
        ledgerTransactionTypeId: 'ltt-expense',
        categoryId: 'cat-1'
      },
      {
        id: 'plan-2',
        plannedAmount: 19800,
        plannedDate: new Date('2026-03-11T00:00:00.000Z'),
        fundingAccountId: 'acc-2',
        ledgerTransactionTypeId: 'ltt-expense',
        categoryId: 'cat-1'
      }
    ],
    collected: {
      amount: 19800,
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      fundingAccountId: 'acc-1',
      ledgerTransactionTypeId: 'ltt-expense',
      categoryId: 'cat-1'
    }
  });

  assert.deepEqual(result, {
    outcome: 'matched',
    planItemId: 'plan-1'
  });
});

test('resolvePlanItemAutoMatch returns ambiguous when multiple candidates remain after every filter', () => {
  const result = resolvePlanItemAutoMatch({
    candidates: [
      {
        id: 'plan-1',
        plannedAmount: 98000,
        plannedDate: new Date('2026-03-25T00:00:00.000Z'),
        fundingAccountId: 'acc-1',
        ledgerTransactionTypeId: 'ltt-expense',
        categoryId: 'cat-1'
      },
      {
        id: 'plan-2',
        plannedAmount: 98000,
        plannedDate: new Date('2026-03-26T00:00:00.000Z'),
        fundingAccountId: 'acc-1',
        ledgerTransactionTypeId: 'ltt-expense',
        categoryId: 'cat-1'
      }
    ],
    collected: {
      amount: 98000,
      occurredOn: new Date('2026-03-25T00:00:00.000Z'),
      fundingAccountId: 'acc-1',
      ledgerTransactionTypeId: 'ltt-expense',
      categoryId: 'cat-1'
    }
  });

  assert.deepEqual(result, {
    outcome: 'ambiguous',
    planItemIds: ['plan-1', 'plan-2']
  });
});

test('resolvePlanItemAutoMatch returns unmatched when the remaining candidate is outside the date tolerance or category', () => {
  const result = resolvePlanItemAutoMatch({
    candidates: [
      {
        id: 'plan-outside-window',
        plannedAmount: 5500,
        plannedDate: new Date(
          `2026-03-${String(12 + planItemMatchDateToleranceDays + 1).padStart(2, '0')}T00:00:00.000Z`
        ),
        fundingAccountId: 'acc-1',
        ledgerTransactionTypeId: 'ltt-expense',
        categoryId: 'cat-1'
      },
      {
        id: 'plan-category-mismatch',
        plannedAmount: 5500,
        plannedDate: new Date('2026-03-13T00:00:00.000Z'),
        fundingAccountId: 'acc-1',
        ledgerTransactionTypeId: 'ltt-expense',
        categoryId: 'cat-2'
      }
    ],
    collected: {
      amount: 5500,
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      fundingAccountId: 'acc-1',
      ledgerTransactionTypeId: 'ltt-expense',
      categoryId: 'cat-1'
    }
  });

  assert.deepEqual(result, {
    outcome: 'unmatched'
  });
});
