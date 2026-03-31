import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectedTransactionStatus } from '@prisma/client';
import { resolveImportedRowAutoPreparation } from '../src/modules/import-batches/imported-row-auto-preparation.policy';

test('resolveImportedRowAutoPreparation promotes a clean classified row to ready-to-post', () => {
  const result = resolveImportedRowAutoPreparation({
    type: 'EXPENSE',
    requestedCategoryId: 'cat-1',
    matchedPlanItemCategoryId: null,
    hasDuplicateSourceFingerprint: false
  });

  assert.deepEqual(result, {
    effectiveCategoryId: 'cat-1',
    nextStatus: CollectedTransactionStatus.READY_TO_POST,
    allowPlanItemMatch: true
  });
});

test('resolveImportedRowAutoPreparation borrows the matched plan item category when the request omitted it', () => {
  const result = resolveImportedRowAutoPreparation({
    type: 'EXPENSE',
    requestedCategoryId: null,
    matchedPlanItemCategoryId: 'cat-from-plan',
    hasDuplicateSourceFingerprint: false
  });

  assert.deepEqual(result, {
    effectiveCategoryId: 'cat-from-plan',
    nextStatus: CollectedTransactionStatus.READY_TO_POST,
    allowPlanItemMatch: true
  });
});

test('resolveImportedRowAutoPreparation keeps duplicate candidates in collected status and suppresses automatic plan binding', () => {
  const result = resolveImportedRowAutoPreparation({
    type: 'EXPENSE',
    requestedCategoryId: null,
    matchedPlanItemCategoryId: 'cat-from-plan',
    hasDuplicateSourceFingerprint: true
  });

  assert.deepEqual(result, {
    effectiveCategoryId: 'cat-from-plan',
    nextStatus: CollectedTransactionStatus.COLLECTED,
    allowPlanItemMatch: false
  });
});

test('resolveImportedRowAutoPreparation leaves income and expense rows reviewed when no category is available', () => {
  const result = resolveImportedRowAutoPreparation({
    type: 'INCOME',
    requestedCategoryId: null,
    matchedPlanItemCategoryId: null,
    hasDuplicateSourceFingerprint: false
  });

  assert.deepEqual(result, {
    effectiveCategoryId: null,
    nextStatus: CollectedTransactionStatus.REVIEWED,
    allowPlanItemMatch: true
  });
});
