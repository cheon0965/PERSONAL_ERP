import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from '../../support/request-api/index';

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
        defaultAccountSubjectId: 'as-1-4100',
        isActive: true
      },
      {
        id: 'cat-1',
        name: 'Fuel',
        kind: 'EXPENSE',
        defaultAccountSubjectId: 'as-1-5100',
        isActive: true
      },
      {
        id: 'cat-1c',
        name: 'Utilities',
        kind: 'EXPENSE',
        defaultAccountSubjectId: 'as-1-5100',
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
      defaultAccountSubjectId: 'as-1-5100',
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
        defaultAccountSubjectId: 'as-1-4100',
        isActive: true
      },
      {
        id: 'cat-1',
        name: 'Fuel',
        kind: 'EXPENSE',
        defaultAccountSubjectId: 'as-1-5100',
        isActive: true
      },
      {
        id: 'cat-1c',
        name: 'Utilities',
        kind: 'EXPENSE',
        defaultAccountSubjectId: 'as-1-5100',
        isActive: true
      },
      {
        id: 'cat-1d',
        name: 'Legacy parking',
        kind: 'EXPENSE',
        defaultAccountSubjectId: 'as-1-5100',
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
      defaultAccountSubjectId: 'as-1-5100',
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
        normalizedName: 'office snacks',
        kind: 'EXPENSE',
        defaultAccountSubjectId: 'as-1-5100',
        isActive: true
      }
    );
  } finally {
    await context.close();
  }
});

test('POST /categories accepts an active system P&L subject with the same category kind', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountSubjects.push({
      id: 'as-1-5110',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      code: '5110',
      name: '원재료비',
      statementType: 'PROFIT_AND_LOSS',
      normalSide: 'DEBIT',
      subjectKind: 'EXPENSE',
      isSystem: true,
      isActive: true
    });

    const response = await context.request('/categories', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Ingredients',
        kind: 'EXPENSE',
        defaultAccountSubjectId: 'as-1-5110'
      }
    });

    assert.equal(response.status, 201);
    assert.equal(
      (response.body as { defaultAccountSubjectId: string })
        .defaultAccountSubjectId,
      'as-1-5110'
    );
  } finally {
    await context.close();
  }
});

test('POST /categories rejects a mismatched, cross-workspace, or balance-sheet default subject', async () => {
  const context = await createRequestTestContext();

  try {
    for (const defaultAccountSubjectId of [
      'as-1-4100',
      'as-2-5100',
      'as-1-1010'
    ]) {
      const response = await context.request('/categories', {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          name: `Invalid ${defaultAccountSubjectId}`,
          kind: 'EXPENSE',
          defaultAccountSubjectId
        }
      });

      assert.equal(response.status, 400);
    }
  } finally {
    await context.close();
  }
});

test('POST /categories keeps transfer categories unmapped', async () => {
  const context = await createRequestTestContext();

  try {
    const created = await context.request('/categories', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Internal transfer',
        kind: 'TRANSFER'
      }
    });
    const rejected = await context.request('/categories', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Invalid transfer',
        kind: 'TRANSFER',
        defaultAccountSubjectId: 'as-1-5100'
      }
    });

    assert.equal(created.status, 201);
    assert.equal(
      (created.body as { defaultAccountSubjectId: string | null })
        .defaultAccountSubjectId,
      null
    );
    assert.equal(rejected.status, 400);
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
      defaultAccountSubjectId: 'as-1-5100',
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
        normalizedName: 'fuel and toll',
        kind: 'EXPENSE',
        defaultAccountSubjectId: 'as-1-5100',
        isActive: false
      }
    );
  } finally {
    await context.close();
  }
});

test('PATCH /categories/:id preserves an omitted mapping and resets null to the generic subject', async () => {
  const context = await createRequestTestContext();

  try {
    const category = context.state.categories.find(
      (candidate) => candidate.id === 'cat-1'
    );
    assert.ok(category);
    category.defaultAccountSubjectId = 'as-1-custom-expense';

    const preserved = await context.request('/categories/cat-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Fuel preserved'
      }
    });
    const reset = await context.request('/categories/cat-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Fuel reset',
        defaultAccountSubjectId: null
      }
    });

    assert.equal(preserved.status, 200);
    assert.equal(
      (preserved.body as { defaultAccountSubjectId: string })
        .defaultAccountSubjectId,
      'as-1-custom-expense'
    );
    assert.equal(reset.status, 200);
    assert.equal(
      (reset.body as { defaultAccountSubjectId: string })
        .defaultAccountSubjectId,
      'as-1-5100'
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
      defaultAccountSubjectId: 'as-1-5100',
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
      defaultAccountSubjectId: 'as-1-5100',
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
