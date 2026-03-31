import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  JournalEntryStatus,
  OpeningBalanceSourceKind
} from '@prisma/client';
import {
  assertAccountingPeriodCanBeClosed,
  assertAccountingPeriodCanBeReopened,
  assertAccountingPeriodCanBeReopenedWithoutDependents
} from '../src/modules/accounting-periods/accounting-period-transition.policy';
import {
  assertCollectedTransactionCanBeConfirmed,
  assertCollectedTransactionCanBeCorrected
} from '../src/modules/collected-transactions/collected-transaction-transition.policy';
import {
  assertJournalEntryCanBeCorrected,
  assertJournalEntryCanBeReversed
} from '../src/modules/journal-entries/journal-entry-transition.policy';

test('accounting period transition policy allows closing an open period and reopening a locked period', () => {
  assert.doesNotThrow(() =>
    assertAccountingPeriodCanBeClosed(AccountingPeriodStatus.OPEN)
  );
  assert.doesNotThrow(() =>
    assertAccountingPeriodCanBeReopened(AccountingPeriodStatus.LOCKED)
  );
});

test('accounting period transition policy rejects invalid close and reopen transitions', async () => {
  await assert.rejects(
    async () =>
      assertAccountingPeriodCanBeClosed(AccountingPeriodStatus.LOCKED),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === '이미 잠긴 운영 기간입니다.'
  );

  await assert.rejects(
    async () =>
      assertAccountingPeriodCanBeReopened(AccountingPeriodStatus.OPEN),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === '잠금된 운영 기간만 재오픈할 수 있습니다.'
  );
});

test('accounting period transition policy rejects reopen when carry-forward outputs already exist', async () => {
  await assert.rejects(
    async () =>
      assertAccountingPeriodCanBeReopenedWithoutDependents({
        carryForwardRecordId: 'carry-forward-1',
        nextOpeningBalanceSourceKind: null
      }),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message ===
        '차기 이월이 이미 생성된 운영 기간은 재오픈할 수 없습니다.'
  );

  await assert.rejects(
    async () =>
      assertAccountingPeriodCanBeReopenedWithoutDependents({
        carryForwardRecordId: null,
        nextOpeningBalanceSourceKind: OpeningBalanceSourceKind.CARRY_FORWARD
      }),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message ===
        '다음 운영 기간에 오프닝 잔액 스냅샷이 이미 생성되어 재오픈할 수 없습니다.'
  );
});

test('collected transaction transition policy allows confirmable and correctable states', () => {
  assert.doesNotThrow(() =>
    assertCollectedTransactionCanBeConfirmed({
      status: CollectedTransactionStatus.READY_TO_POST,
      periodStatus: AccountingPeriodStatus.OPEN,
      postedJournalEntryId: null
    })
  );
  assert.doesNotThrow(() =>
    assertCollectedTransactionCanBeCorrected(CollectedTransactionStatus.POSTED)
  );
});

test('collected transaction transition policy rejects locked period and invalid correction transitions', async () => {
  await assert.rejects(
    async () =>
      assertCollectedTransactionCanBeConfirmed({
        status: CollectedTransactionStatus.COLLECTED,
        periodStatus: AccountingPeriodStatus.LOCKED,
        postedJournalEntryId: null
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message ===
        'Collected transaction in a locked period cannot be confirmed.'
  );

  await assert.rejects(
    async () =>
      assertCollectedTransactionCanBeCorrected(
        CollectedTransactionStatus.COLLECTED
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === 'Only posted collected transactions can be corrected.'
  );
});

test('journal entry transition policy allows posted entries to be reversed or corrected', () => {
  assert.doesNotThrow(() =>
    assertJournalEntryCanBeReversed(JournalEntryStatus.POSTED)
  );
  assert.doesNotThrow(() =>
    assertJournalEntryCanBeCorrected(JournalEntryStatus.POSTED)
  );
});

test('journal entry transition policy rejects non-posted entries', async () => {
  await assert.rejects(
    async () => assertJournalEntryCanBeReversed(JournalEntryStatus.REVERSED),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === 'Only posted journal entries can be reversed.'
  );

  await assert.rejects(
    async () => assertJournalEntryCanBeCorrected(JournalEntryStatus.SUPERSEDED),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === 'Only posted journal entries can be corrected.'
  );
});
