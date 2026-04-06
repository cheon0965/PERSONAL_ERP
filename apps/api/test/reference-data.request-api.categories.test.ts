import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from './request-api.test-support';

test('GET /categories returns only active categories for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/categories', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'cat-1b',
        name: 'Salary',
        kind: 'INCOME',
        isActive: true
      },
      {
        id: 'cat-1',
        name: 'Fuel',
        kind: 'EXPENSE',
        isActive: true
      },
      {
        id: 'cat-1c',
        name: 'Utilities',
        kind: 'EXPENSE',
        isActive: true
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /categories?includeInactive=true includes inactive categories for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.categories.push({
      id: 'cat-1d',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Legacy parking',
      kind: 'EXPENSE',
      isActive: false
    });

    const response = await context.request('/categories?includeInactive=true', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'cat-1b',
        name: 'Salary',
        kind: 'INCOME',
        isActive: true
      },
      {
        id: 'cat-1',
        name: 'Fuel',
        kind: 'EXPENSE',
        isActive: true
      },
      {
        id: 'cat-1c',
        name: 'Utilities',
        kind: 'EXPENSE',
        isActive: true
      },
      {
        id: 'cat-1d',
        name: 'Legacy parking',
        kind: 'EXPENSE',
        isActive: false
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /categories creates a category for the current workspace when the membership can manage reference data', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/categories', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Office snacks',
        kind: 'EXPENSE'
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'cat-generated-5',
      name: 'Office snacks',
      kind: 'EXPENSE',
      isActive: true
    });
    assert.deepEqual(
      context.state.categories.find(
        (candidate) => candidate.id === 'cat-generated-5'
      ),
      {
        id: 'cat-generated-5',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Office snacks',
        kind: 'EXPENSE',
        isActive: true
      }
    );
  } finally {
    await context.close();
  }
});

test('POST /categories returns 403 when the current membership cannot create categories', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request('/categories', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Office snacks',
        kind: 'EXPENSE'
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('PATCH /categories/:id renames and deactivates a category for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/categories/cat-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Fuel and toll',
        isActive: false
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'cat-1',
      name: 'Fuel and toll',
      kind: 'EXPENSE',
      isActive: false
    });
    assert.deepEqual(
      context.state.categories.find((candidate) => candidate.id === 'cat-1'),
      {
        id: 'cat-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Fuel and toll',
        kind: 'EXPENSE',
        isActive: false
      }
    );
  } finally {
    await context.close();
  }
});

test('PATCH /categories/:id can reactivate an inactive category for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.categories.push({
      id: 'cat-1d',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Legacy parking',
      kind: 'EXPENSE',
      isActive: false
    });

    const response = await context.request('/categories/cat-1d', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Legacy parking',
        isActive: true
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'cat-1d',
      name: 'Legacy parking',
      kind: 'EXPENSE',
      isActive: true
    });
  } finally {
    await context.close();
  }
});

test('PATCH /categories/:id returns 403 when the current membership cannot update categories', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/categories/cat-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Fuel and toll',
        isActive: false
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});
