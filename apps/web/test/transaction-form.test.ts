import assert from 'node:assert/strict';
import test from 'node:test';
import type { CollectedTransactionDetailItem } from '@personal-erp/contracts';
import {
  buildPreservedPostingDimensionPayload,
  mapDetailToFormInput
} from '../src/features/transactions/model/transaction-form.mapper';
import { resolveManualCollectedTransactionPostingStatus } from '../src/features/transactions/model/transaction-workflow';

test('transaction detail mapper supplies blank optional posting dimensions', () => {
  const transaction: CollectedTransactionDetailItem = {
    id: 'txn-expense',
    businessDate: '2026-05-05',
    title: '월 임차료',
    type: 'EXPENSE',
    amountWon: 620_000,
    fundingAccountId: 'acc-main',
    categoryId: 'cat-rent',
    memo: null,
    sourceKind: 'MANUAL',
    postingStatus: 'REVIEWED',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  };
  const mapped = mapDetailToFormInput(transaction);

  assert.equal(mapped.ledgerTransactionTypeId, '');
  assert.equal(mapped.counterpartyFundingAccountId, '');
  assert.equal(mapped.fundingAccountDirection, '');
});

test('transaction detail mapper preserves explicit posting dimensions for edits', () => {
  const transaction: CollectedTransactionDetailItem = {
    id: 'txn-transfer',
    businessDate: '2026-05-06',
    title: '자금 이체',
    type: 'TRANSFER',
    amountWon: 300_000,
    ledgerTransactionTypeId: 'ltt-transfer',
    fundingAccountDirection: 'OUTFLOW',
    fundingAccountId: 'acc-main',
    counterpartyFundingAccountId: 'acc-reserve',
    categoryId: null,
    memo: null,
    sourceKind: 'MANUAL',
    postingStatus: 'READY_TO_POST',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  };

  assert.deepEqual(mapDetailToFormInput(transaction), {
    title: '자금 이체',
    amountWon: 300_000,
    businessDate: '2026-05-06',
    type: 'TRANSFER',
    ledgerTransactionTypeId: 'ltt-transfer',
    accountId: 'acc-main',
    counterpartyFundingAccountId: 'acc-reserve',
    fundingAccountDirection: 'OUTFLOW',
    categoryId: '',
    memo: ''
  });
});

test('posting dimensions are preserved only while edit type and funding account remain unchanged', () => {
  const postingDimensions = {
    type: 'TRANSFER' as const,
    accountId: 'acc-main',
    ledgerTransactionTypeId: 'ltt-transfer',
    counterpartyFundingAccountId: 'acc-reserve',
    fundingAccountDirection: 'OUTFLOW' as const
  };
  const initialTransaction = {
    type: 'TRANSFER' as const,
    fundingAccountId: 'acc-main'
  };

  assert.deepEqual(
    buildPreservedPostingDimensionPayload(
      postingDimensions,
      initialTransaction
    ),
    {
      ledgerTransactionTypeId: 'ltt-transfer',
      counterpartyFundingAccountId: 'acc-reserve',
      fundingAccountDirection: 'OUTFLOW'
    }
  );
  assert.deepEqual(
    buildPreservedPostingDimensionPayload(
      { ...postingDimensions, type: 'EXPENSE' },
      initialTransaction
    ),
    {}
  );
  assert.deepEqual(
    buildPreservedPostingDimensionPayload(
      { ...postingDimensions, accountId: 'acc-reserve' },
      initialTransaction
    ),
    {}
  );
});

test('manual transfer remains reviewed until counterparty and direction are complete', () => {
  assert.equal(
    resolveManualCollectedTransactionPostingStatus({ type: 'TRANSFER' }),
    'REVIEWED'
  );
  assert.equal(
    resolveManualCollectedTransactionPostingStatus({
      type: 'TRANSFER',
      counterpartyFundingAccountId: 'acc-reserve',
      fundingAccountDirection: 'OUTFLOW'
    }),
    'READY_TO_POST'
  );
});
