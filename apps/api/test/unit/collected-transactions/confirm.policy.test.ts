import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../../../src/common/application/errors/app-error';
import {
  assertConfirmJournalAccountSubjectIdsResolved,
  assertConfirmJournalLinesSupported,
  resolveConfirmCollectedTransactionJournalLines
} from '../../../src/modules/collected-transactions/public';

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
      categoryAccountSubjectId: 'subject-fuel-expense',
      accountSubjectIds
    })
  );

  assert.equal(journalLines.length, 2);
  assert.equal(journalLines[0]?.accountSubjectId, 'subject-fuel-expense');
  assert.equal(journalLines[1]?.accountSubjectId, 'subject-asset');
});

test('confirm policy posts transfer between both funding accounts without profit or loss', () => {
  const lines = assertConfirmJournalLinesSupported(
    resolveConfirmCollectedTransactionJournalLines({
      postingPolicyKey: 'TRANSFER_BASIC',
      amount: 250000,
      title: '운영 계좌 이체',
      fundingAccountId: 'bank-source',
      fundingAccountType: 'BANK',
      fundingAccountSubjectId: 'subject-source-asset',
      counterpartyFundingAccountId: 'cash-destination',
      counterpartyFundingAccountType: 'CASH',
      counterpartyFundingAccountSubjectId: 'subject-destination-asset',
      fundingAccountDirection: 'OUTFLOW',
      accountSubjectIds
    })
  );

  assert.deepEqual(
    lines.map((line) => ({
      accountSubjectId: line.accountSubjectId,
      fundingAccountId: line.fundingAccountId,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount
    })),
    [
      {
        accountSubjectId: 'subject-destination-asset',
        fundingAccountId: 'cash-destination',
        debitAmount: 250000,
        creditAmount: 0
      },
      {
        accountSubjectId: 'subject-source-asset',
        fundingAccountId: 'bank-source',
        debitAmount: 0,
        creditAmount: 250000
      }
    ]
  );
});

test('confirm policy posts card payment as liability debit and settlement asset credit', () => {
  const lines = assertConfirmJournalLinesSupported(
    resolveConfirmCollectedTransactionJournalLines({
      postingPolicyKey: 'CARD_PAYMENT',
      amount: 180000,
      title: '카드대금 결제',
      fundingAccountId: 'bank-payment',
      fundingAccountType: 'BANK',
      fundingAccountSubjectId: 'subject-bank-asset',
      counterpartyFundingAccountId: 'card-account',
      counterpartyFundingAccountType: 'CARD',
      counterpartyFundingAccountSubjectId: 'subject-card-liability',
      fundingAccountDirection: 'OUTFLOW',
      accountSubjectIds
    })
  );

  assert.equal(lines[0]?.accountSubjectId, 'subject-card-liability');
  assert.equal(lines[0]?.fundingAccountId, 'card-account');
  assert.equal(lines[0]?.debitAmount, 180000);
  assert.equal(lines[1]?.accountSubjectId, 'subject-bank-asset');
  assert.equal(lines[1]?.fundingAccountId, 'bank-payment');
  assert.equal(lines[1]?.creditAmount, 180000);
});

test('confirm collected transaction policy rejects missing subjects and non-postable policies', async () => {
  await assert.rejects(
    async () => assertConfirmJournalAccountSubjectIdsResolved(null),
    (error: unknown) =>
      error instanceof AppError &&
      error.kind === 'internal' &&
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
      error instanceof AppError &&
      error.kind === 'validation' &&
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
      error instanceof AppError &&
      error.kind === 'validation' &&
      error.message ===
        'This posting policy is not supported for collected transaction confirmation.'
  );
});
