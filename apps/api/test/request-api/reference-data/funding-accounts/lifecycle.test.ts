import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectedTransactionStatus } from '@prisma/client';
import { createRequestTestContext } from '../../../support/request-api/index';

test('DELETE /funding-accounts/:id deletes an unused funding account for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-clean-delete',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Mistaken account',
      normalizedName: 'mistaken account',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 5,
      status: 'ACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });

    const response = await context.request(
      '/funding-accounts/acc-clean-delete',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 204);
    assert.equal(
      context.state.accounts.some(
        (candidate) => candidate.id === 'acc-clean-delete'
      ),
      false
    );
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'funding_account.delete' &&
          event.eventName === 'audit.action_succeeded' &&
          event.result === 'SUCCESS' &&
          event.resourceId === 'acc-clean-delete'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('DELETE /funding-accounts/:id rejects deleting a funding account with transaction history', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-history-delete',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Account with history',
      normalizedName: 'account with history',
      type: 'BANK',
      balanceWon: 0,
      sortOrder: 5,
      status: 'INACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });
    context.state.collectedTransactions.push({
      id: 'ctx-history-delete',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-history-delete',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: null,
      title: 'Historical expense',
      occurredOn: new Date('2026-04-01T00:00:00.000Z'),
      amount: 10_000,
      status: CollectedTransactionStatus.COLLECTED,
      memo: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });

    const response = await context.request(
      '/funding-accounts/acc-history-delete',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);
    const errorBody = response.body as { message: string };
    assert.match(errorBody.message, /수집 거래 1건/);
    assert.equal(
      context.state.accounts.some(
        (candidate) => candidate.id === 'acc-history-delete'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('DELETE /funding-accounts/:id returns 403 when the current membership cannot delete funding accounts', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';
    context.state.accounts.push({
      id: 'acc-clean-delete-viewer',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Viewer delete account',
      normalizedName: 'viewer delete account',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 5,
      status: 'ACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });

    const response = await context.request(
      '/funding-accounts/acc-clean-delete-viewer',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 403);
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'funding_account.delete' &&
          event.eventName === 'authorization.action_denied' &&
          event.result === 'DENIED'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id renames and deactivates a funding account for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts/acc-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Main operating account',
        status: 'INACTIVE'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'acc-1',
      name: 'Main operating account',
      type: 'BANK',
      balanceWon: 2_000_000,
      status: 'INACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });
    assert.deepEqual(
      context.state.accounts.find((candidate) => candidate.id === 'acc-1'),
      {
        id: 'acc-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Main operating account',
        normalizedName: 'main operating account',
        type: 'BANK',
        balanceWon: 2_000_000,
        sortOrder: 0,
        status: 'INACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id can reactivate an inactive funding account for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-1c',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 3,
      status: 'INACTIVE'
    });

    const response = await context.request('/funding-accounts/acc-1c', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Legacy cashbox',
        status: 'ACTIVE'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'acc-1c',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      status: 'ACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id can close an inactive funding account for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-1c',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 3,
      status: 'INACTIVE'
    });

    const response = await context.request('/funding-accounts/acc-1c', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Legacy cashbox',
        status: 'CLOSED'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'acc-1c',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      status: 'CLOSED',
      bootstrapStatus: 'NOT_REQUIRED'
    });
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id rejects closing an active funding account without first deactivating it', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts/acc-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Main checking',
        status: 'CLOSED'
      }
    });

    assert.equal(response.status, 409);
    const errorBody = response.body as { message: string };
    assert.equal(
      errorBody.message,
      '자금수단을 종료하려면 먼저 비활성 상태로 전환해 주세요.'
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id rejects updating a closed funding account', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-1c',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Closed settlement card',
      type: 'CARD',
      balanceWon: 0,
      sortOrder: 3,
      status: 'CLOSED'
    });

    const response = await context.request('/funding-accounts/acc-1c', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Closed settlement card renamed',
        status: 'ACTIVE'
      }
    });

    assert.equal(response.status, 409);
    const errorBody = response.body as { message: string };
    assert.equal(
      errorBody.message,
      '종료된 자금수단은 현재 범위에서 수정할 수 없습니다.'
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id returns 403 when the current membership cannot update funding accounts', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/funding-accounts/acc-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Main operating account',
        status: 'INACTIVE'
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});
