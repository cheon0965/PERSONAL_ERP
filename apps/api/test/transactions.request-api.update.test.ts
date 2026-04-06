import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('PATCH /collected-transactions/:id updates a pending collected transaction and returns the shared item shape', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-update',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      year: 2026,

      month: 3,

      startDate: new Date('2026-03-01T00:00:00.000Z'),

      endDate: new Date('2026-04-01T00:00:00.000Z'),

      status: AccountingPeriodStatus.OPEN,

      openedAt: new Date('2026-03-01T00:00:00.000Z'),

      lockedAt: null,

      createdAt: new Date('2026-03-01T00:00:00.000Z'),

      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    context.state.collectedTransactions.push({
      id: 'ctx-update-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-open-update',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill',

      occurredOn: new Date('2026-03-03T00:00:00.000Z'),

      amount: 84_000,

      status: CollectedTransactionStatus.READY_TO_POST,

      memo: 'Full tank',

      createdAt: new Date('2026-03-03T08:00:00.000Z'),

      updatedAt: new Date('2026-03-03T08:00:00.000Z')
    });

    const response = await context.request(
      '/collected-transactions/ctx-update-1',

      {
        method: 'PATCH',

        headers: context.authHeaders(),

        body: {
          title: 'Fuel refill adjusted',

          type: TransactionType.EXPENSE,

          amountWon: 91_000,

          businessDate: '2026-03-04',

          fundingAccountId: 'acc-1',

          categoryId: 'cat-1c',

          memo: 'Adjusted after receipt review'
        }
      }
    );

    assert.equal(response.status, 200);

    assert.deepEqual(response.body, {
      id: 'ctx-update-1',

      businessDate: '2026-03-04',

      title: 'Fuel refill adjusted',

      type: TransactionType.EXPENSE,

      amountWon: 91_000,

      fundingAccountName: 'Main checking',

      categoryName: 'Utilities',

      sourceKind: 'MANUAL',

      postingStatus: 'READY_TO_POST',

      postedJournalEntryId: null,

      postedJournalEntryNumber: null,

      matchedPlanItemId: null,

      matchedPlanItemTitle: null
    });

    assert.deepEqual(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-update-1'
      ),

      {
        id: 'ctx-update-1',

        tenantId: 'tenant-1',

        ledgerId: 'ledger-1',

        periodId: 'period-open-update',

        ledgerTransactionTypeId: 'ltt-1-expense',

        fundingAccountId: 'acc-1',

        categoryId: 'cat-1c',

        matchedPlanItemId: null,

        importBatchId: null,

        importedRowId: null,

        sourceFingerprint: null,

        title: 'Fuel refill adjusted',

        occurredOn: new Date('2026-03-04T00:00:00.000Z'),

        amount: 91_000,

        status: CollectedTransactionStatus.READY_TO_POST,

        memo: 'Adjusted after receipt review',

        createdAt: new Date('2026-03-03T08:00:00.000Z'),

        updatedAt: context.state.collectedTransactions.find(
          (candidate) => candidate.id === 'ctx-update-1'
        )?.updatedAt
      }
    );

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.update' &&
          candidate.details.collectedTransactionId === 'ctx-update-1' &&
          candidate.details.periodId === 'period-open-update'
      )
    );
  } finally {
    await context.close();
  }
});

test('PATCH /collected-transactions/:id returns 403 when the current membership role cannot update collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    context.state.accountingPeriods.push({
      id: 'period-open-update-denied',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      year: 2026,

      month: 3,

      startDate: new Date('2026-03-01T00:00:00.000Z'),

      endDate: new Date('2026-04-01T00:00:00.000Z'),

      status: AccountingPeriodStatus.OPEN,

      openedAt: new Date('2026-03-01T00:00:00.000Z'),

      lockedAt: null,

      createdAt: new Date('2026-03-01T00:00:00.000Z'),

      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    context.state.collectedTransactions.push({
      id: 'ctx-update-denied-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-open-update-denied',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill',

      occurredOn: new Date('2026-03-03T00:00:00.000Z'),

      amount: 84_000,

      status: CollectedTransactionStatus.READY_TO_POST,

      memo: 'Full tank',

      createdAt: new Date('2026-03-03T08:00:00.000Z'),

      updatedAt: new Date('2026-03-03T08:00:00.000Z')
    });

    const response = await context.request(
      '/collected-transactions/ctx-update-denied-1',

      {
        method: 'PATCH',

        headers: context.authHeaders(),

        body: {
          title: 'Fuel refill adjusted',

          type: TransactionType.EXPENSE,

          amountWon: 91_000,

          businessDate: '2026-03-04',

          fundingAccountId: 'acc-1',

          categoryId: 'cat-1',

          memo: 'Adjusted after receipt review'
        }
      }
    );

    assert.equal(response.status, 403);

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.update' &&
          candidate.details.collectedTransactionId === 'ctx-update-denied-1' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});

test('PATCH /collected-transactions/:id returns 409 for already posted collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-update-posted',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      year: 2026,

      month: 3,

      startDate: new Date('2026-03-01T00:00:00.000Z'),

      endDate: new Date('2026-04-01T00:00:00.000Z'),

      status: AccountingPeriodStatus.OPEN,

      openedAt: new Date('2026-03-01T00:00:00.000Z'),

      lockedAt: null,

      createdAt: new Date('2026-03-01T00:00:00.000Z'),

      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    const response = await context.request(
      '/collected-transactions/ctx-seed-2',

      {
        method: 'PATCH',

        headers: context.authHeaders(),

        body: {
          title: 'Fuel refill adjusted',

          type: TransactionType.EXPENSE,

          amountWon: 91_000,

          businessDate: '2026-03-20',

          fundingAccountId: 'acc-1',

          categoryId: 'cat-1',

          memo: 'Adjusted after receipt review'
        }
      }
    );

    assert.equal(response.status, 409);

    assert.deepEqual(response.body, {
      statusCode: 409,

      message: 'Only unposted collected transactions can be updated.',

      error: 'Conflict'
    });
  } finally {
    await context.close();
  }
});

test('PATCH /collected-transactions/:id re-checks the transaction inside the transaction boundary before updating', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-update-race',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      year: 2026,

      month: 3,

      startDate: new Date('2026-03-01T00:00:00.000Z'),

      endDate: new Date('2026-04-01T00:00:00.000Z'),

      status: AccountingPeriodStatus.OPEN,

      openedAt: new Date('2026-03-01T00:00:00.000Z'),

      lockedAt: null,

      createdAt: new Date('2026-03-01T00:00:00.000Z'),

      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    context.state.collectedTransactions.push({
      id: 'ctx-update-race-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-open-update-race',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill draft',

      occurredOn: new Date('2026-03-03T00:00:00.000Z'),

      amount: 84_000,

      status: CollectedTransactionStatus.READY_TO_POST,

      memo: 'Before race',

      createdAt: new Date('2026-03-03T08:00:00.000Z'),

      updatedAt: new Date('2026-03-03T08:00:00.000Z')
    });

    context.state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId =
      'ctx-update-race-1';

    const response = await context.request(
      '/collected-transactions/ctx-update-race-1',

      {
        method: 'PATCH',

        headers: context.authHeaders(),

        body: {
          title: 'Fuel refill adjusted',

          type: TransactionType.EXPENSE,

          amountWon: 91_000,

          businessDate: '2026-03-04',

          fundingAccountId: 'acc-1',

          categoryId: 'cat-1',

          memo: 'Adjusted after receipt review'
        }
      }
    );

    assert.equal(response.status, 409);

    assert.deepEqual(response.body, {
      statusCode: 409,

      message:
        'Posted collected transactions must be adjusted through journal entries.',

      error: 'Conflict'
    });

    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-update-race-1'
      )?.title,

      'Fuel refill draft'
    );

    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-update-race-1'
      )?.status,

      CollectedTransactionStatus.POSTED
    );
  } finally {
    await context.close();
  }
});
