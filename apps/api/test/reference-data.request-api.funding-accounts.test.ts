import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from './request-api.test-support';

test('GET /funding-accounts returns only active funding accounts for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'acc-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 2_000_000,
        status: 'ACTIVE'
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        status: 'ACTIVE'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /funding-accounts?includeInactive=true includes inactive funding accounts for the current workspace ledger', async () => {
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

    const response = await context.request(
      '/funding-accounts?includeInactive=true',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'acc-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 2_000_000,
        status: 'ACTIVE'
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        status: 'ACTIVE'
      },
      {
        id: 'acc-1c',
        name: 'Legacy cashbox',
        type: 'CASH',
        balanceWon: 0,
        status: 'INACTIVE'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /funding-accounts creates a funding account for the current workspace when the membership can manage reference data', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Operations cashbox',
        type: 'CASH'
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'acc-generated-4',
      name: 'Operations cashbox',
      type: 'CASH',
      balanceWon: 0,
      status: 'ACTIVE'
    });
    assert.deepEqual(
      context.state.accounts.find(
        (candidate) => candidate.id === 'acc-generated-4'
      ),
      {
        id: 'acc-generated-4',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Operations cashbox',
        type: 'CASH',
        balanceWon: 0,
        sortOrder: 2,
        status: 'ACTIVE'
      }
    );
  } finally {
    await context.close();
  }
});

test('POST /funding-accounts returns 403 when the current membership cannot create funding accounts', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request('/funding-accounts', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Operations cashbox',
        type: 'CASH'
      }
    });

    assert.equal(response.status, 403);
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
      status: 'INACTIVE'
    });
    assert.deepEqual(
      context.state.accounts.find((candidate) => candidate.id === 'acc-1'),
      {
        id: 'acc-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Main operating account',
        type: 'BANK',
        balanceWon: 2_000_000,
        sortOrder: 0,
        status: 'INACTIVE'
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
      status: 'ACTIVE'
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
      status: 'CLOSED'
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
