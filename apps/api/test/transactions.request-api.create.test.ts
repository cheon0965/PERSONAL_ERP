import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountingPeriodStatus, TransactionType } from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('POST /collected-transactions returns 400 when the request body fails DTO validation', async () => {
  const context = await createRequestTestContext();

  try {
    const initialTransactionCount = context.state.collectedTransactions.length;

    const response = await context.request('/collected-transactions', {
      method: 'POST',

      headers: context.authHeaders(),

      body: {
        title: 'Fuel refill',

        type: TransactionType.EXPENSE,

        amountWon: 0,

        businessDate: 'not-a-date',

        fundingAccountId: 'acc-1',

        categoryId: 'cat-1'
      }
    });

    assert.equal(response.status, 400);

    assert.match(
      JSON.stringify((response.body as { message: string[] }).message),

      /amountWon must not be less than 1/
    );

    assert.equal(
      context.state.collectedTransactions.length,

      initialTransactionCount
    );
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions returns 404 when the funding account is outside the current user scope', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-404',

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

    const initialTransactionCount = context.state.collectedTransactions.length;

    const response = await context.request('/collected-transactions', {
      method: 'POST',

      headers: context.authHeaders(),

      body: {
        title: 'Fuel refill',

        type: TransactionType.EXPENSE,

        amountWon: 84000,

        businessDate: '2026-03-03',

        fundingAccountId: 'acc-2',

        categoryId: 'cat-1',

        memo: 'Full tank'
      }
    });

    assert.equal(response.status, 404);

    assert.equal(
      (response.body as { message: string }).message,

      'Funding account not found'
    );

    assert.equal(
      context.state.collectedTransactions.length,

      initialTransactionCount
    );

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.scope_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.userId === 'user-1' &&
          candidate.details.resource === 'collected_transaction_funding_account'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions returns 403 when the current membership role cannot create collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const initialTransactionCount = context.state.collectedTransactions.length;

    const response = await context.request('/collected-transactions', {
      method: 'POST',

      headers: context.authHeaders(),

      body: {
        title: 'Fuel refill',

        type: TransactionType.EXPENSE,

        amountWon: 84000,

        businessDate: '2026-03-03',

        fundingAccountId: 'acc-1',

        categoryId: 'cat-1',

        memo: 'Full tank'
      }
    });

    assert.equal(response.status, 403);

    assert.equal(
      context.state.collectedTransactions.length,

      initialTransactionCount
    );

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions returns the created collected transaction item shape', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-created',

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

    const response = await context.request('/collected-transactions', {
      method: 'POST',

      headers: context.authHeaders(),

      body: {
        title: 'Fuel refill',

        type: TransactionType.EXPENSE,

        amountWon: 84000,

        businessDate: '2026-03-03',

        fundingAccountId: 'acc-1',

        categoryId: 'cat-1',

        memo: 'Full tank'
      }
    });

    assert.equal(response.status, 201);

    assert.deepEqual(response.body, {
      id: 'ctx-4',

      businessDate: '2026-03-03',

      title: 'Fuel refill',

      type: TransactionType.EXPENSE,

      amountWon: 84000,

      fundingAccountName: 'Main checking',

      categoryName: 'Fuel',

      sourceKind: 'MANUAL',

      postingStatus: 'READY_TO_POST',

      postedJournalEntryId: null,

      postedJournalEntryNumber: null,

      matchedPlanItemId: null,

      matchedPlanItemTitle: null
    });

    assert.equal(context.state.collectedTransactions.length, 4);

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.collectedTransactionId === 'ctx-4' &&
          candidate.details.periodId === 'period-open-created'
      )
    );
  } finally {
    await context.close();
  }
});
