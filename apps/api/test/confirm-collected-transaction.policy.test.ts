import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BadRequestException,
  InternalServerErrorException
} from '@nestjs/common';
import {
  assertConfirmJournalAccountSubjectIdsResolved,
  assertConfirmJournalLinesSupported,
  resolveConfirmCollectedTransactionJournalLines
} from '../src/modules/collected-transactions/confirm-collected-transaction.policy';

const accountSubjectIds = {
  assetSubjectId: 'subject-asset',
  liabilitySubjectId: 'subject-liability',
  incomeSubjectId: 'subject-income',
  expenseSubjectId: 'subject-expense'
};

test('confirm collected transaction policy returns supported journal lines when required subjects exist', () => {
  assert.deepEqual(
    assertConfirmJournalAccountSubjectIdsResolved(accountSubjectIds),
    accountSubjectIds
  );

  const journalLines = assertConfirmJournalLinesSupported(
    resolveConfirmCollectedTransactionJournalLines({
      postingPolicyKey: 'EXPENSE_BASIC',
      amount: 84000,
      title: 'Fuel refill',
      fundingAccountId: 'funding-1',
      accountSubjectIds
    })
  );

  assert.equal(journalLines.length, 2);
  assert.equal(journalLines[0]?.accountSubjectId, 'subject-expense');
  assert.equal(journalLines[1]?.accountSubjectId, 'subject-asset');
});

test('confirm collected transaction policy rejects missing subjects and non-postable policies', async () => {
  await assert.rejects(
    async () => assertConfirmJournalAccountSubjectIdsResolved(null),
    (error: unknown) =>
      error instanceof InternalServerErrorException &&
      error.message === 'Required account subjects are missing in this ledger.'
  );

  await assert.rejects(
    async () =>
      assertConfirmJournalLinesSupported(
        resolveConfirmCollectedTransactionJournalLines({
          postingPolicyKey: 'TRANSFER_BASIC',
          amount: 84000,
          title: 'Account transfer',
          fundingAccountId: 'funding-1',
          accountSubjectIds
        })
      ),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message ===
        'This posting policy requires a second account selection.'
  );

  await assert.rejects(
    async () =>
      assertConfirmJournalLinesSupported(
        resolveConfirmCollectedTransactionJournalLines({
          postingPolicyKey: 'OPENING_BALANCE',
          amount: 84000,
          title: 'Initial opening balance',
          fundingAccountId: 'funding-1',
          accountSubjectIds
        })
      ),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message ===
        'This posting policy is not supported for collected transaction confirmation.'
  );
});
