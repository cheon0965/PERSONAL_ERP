import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('DELETE /collected-transactions/:id deletes a pending collected transaction', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-delete',

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
      id: 'ctx-delete-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-open-delete',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill draft',

      occurredOn: new Date('2026-03-05T00:00:00.000Z'),

      amount: 84_000,

      status: CollectedTransactionStatus.COLLECTED,

      memo: 'Draft entry',

      createdAt: new Date('2026-03-05T08:00:00.000Z'),

      updatedAt: new Date('2026-03-05T08:00:00.000Z')
    });

    const response = await context.request(
      '/collected-transactions/ctx-delete-1',

      {
        method: 'DELETE',

        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 204);

    assert.equal(response.body, null);

    assert.equal(
      context.state.collectedTransactions.some(
        (candidate) => candidate.id === 'ctx-delete-1'
      ),

      false
    );

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.delete' &&
          candidate.details.collectedTransactionId === 'ctx-delete-1' &&
          candidate.details.periodId === 'period-open-delete'
      )
    );
  } finally {
    await context.close();
  }
});

test('DELETE /collected-transactions/:id returns 403 when the current membership role cannot delete collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    context.state.accountingPeriods.push({
      id: 'period-open-delete-denied',

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
      id: 'ctx-delete-denied-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-open-delete-denied',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill draft',

      occurredOn: new Date('2026-03-05T00:00:00.000Z'),

      amount: 84_000,

      status: CollectedTransactionStatus.COLLECTED,

      memo: 'Draft entry',

      createdAt: new Date('2026-03-05T08:00:00.000Z'),

      updatedAt: new Date('2026-03-05T08:00:00.000Z')
    });

    const response = await context.request(
      '/collected-transactions/ctx-delete-denied-1',

      {
        method: 'DELETE',

        headers: context.authHeaders()
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
          candidate.details.action === 'collected_transaction.delete' &&
          candidate.details.collectedTransactionId === 'ctx-delete-denied-1' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});

test('DELETE /collected-transactions/:id returns 409 for already posted collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-delete-posted',

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
        method: 'DELETE',

        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);

    assert.deepEqual(response.body, {
      statusCode: 409,

      message: 'Only unposted collected transactions can be deleted.',

      error: 'Conflict'
    });
  } finally {
    await context.close();
  }
});

test('DELETE /collected-transactions/:id re-checks the transaction inside the transaction boundary before deleting', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-delete-race',

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
      id: 'ctx-delete-race-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-open-delete-race',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill draft',

      occurredOn: new Date('2026-03-05T00:00:00.000Z'),

      amount: 84_000,

      status: CollectedTransactionStatus.READY_TO_POST,

      memo: 'Draft entry',

      createdAt: new Date('2026-03-05T08:00:00.000Z'),

      updatedAt: new Date('2026-03-05T08:00:00.000Z')
    });

    context.state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId =
      'ctx-delete-race-1';

    const response = await context.request(
      '/collected-transactions/ctx-delete-race-1',

      {
        method: 'DELETE',

        headers: context.authHeaders()
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
      context.state.collectedTransactions.some(
        (candidate) => candidate.id === 'ctx-delete-race-1'
      ),

      true
    );

    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-delete-race-1'
      )?.status,

      CollectedTransactionStatus.POSTED
    );
  } finally {
    await context.close();
  }
});
