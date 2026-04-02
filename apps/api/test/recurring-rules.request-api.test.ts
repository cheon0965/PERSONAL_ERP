import assert from 'node:assert/strict';
import test from 'node:test';
import { PlanItemStatus, RecurrenceFrequency } from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
test('GET /recurring-rules returns only the current user recurring rule items without internal ownership fields', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/recurring-rules', {
      headers: context.authHeaders()
    });

    const items = response.body as Array<Record<string, unknown>>;

    assert.equal(response.status, 200);
    assert.deepEqual(items, [
      {
        id: 'rr-seed-1',
        title: 'Phone bill',
        amountWon: 75_000,
        frequency: RecurrenceFrequency.MONTHLY,
        nextRunDate: '2026-03-10',
        fundingAccountName: 'Main checking',
        categoryName: 'Utilities',
        isActive: true
      }
    ]);
    assert.equal(
      items.some((candidate) => 'userId' in candidate),
      false
    );
    assert.equal(
      items.some((candidate) => 'fundingAccountId' in candidate),
      false
    );
    assert.equal(
      items.some((candidate) => 'categoryId' in candidate),
      false
    );
  } finally {
    await context.close();
  }
});

test('POST /recurring-rules returns 400 when the request body fails DTO validation', async () => {
  const context = await createRequestTestContext();

  try {
    const initialRecurringRuleCount = context.state.recurringRules.length;
    const response = await context.request('/recurring-rules', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        amountWon: 0,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 0,
        startDate: 'not-a-date',
        isActive: true
      }
    });

    assert.equal(response.status, 400);
    assert.match(
      JSON.stringify((response.body as { message: string[] }).message),
      /dayOfMonth must not be less than 1/
    );
    assert.equal(
      context.state.recurringRules.length,
      initialRecurringRuleCount
    );
  } finally {
    await context.close();
  }
});

test('POST /recurring-rules returns 404 when the category is outside the current user scope', async () => {
  const context = await createRequestTestContext();

  try {
    const initialRecurringRuleCount = context.state.recurringRules.length;
    const response = await context.request('/recurring-rules', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-2',
        amountWon: 75000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 10,
        startDate: '2026-03-10',
        isActive: true
      }
    });

    assert.equal(response.status, 404);
    assert.equal(
      (response.body as { message: string }).message,
      'Category not found'
    );
    assert.equal(
      context.state.recurringRules.length,
      initialRecurringRuleCount
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.scope_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.userId === 'user-1' &&
          candidate.details.resource === 'recurring_rule_category'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /recurring-rules returns 403 when the current membership role cannot create recurring rules', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';
    const initialRecurringRuleCount = context.state.recurringRules.length;
    const response = await context.request('/recurring-rules', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        amountWon: 75000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 10,
        startDate: '2026-03-10',
        isActive: true
      }
    });

    assert.equal(response.status, 403);
    assert.equal(
      context.state.recurringRules.length,
      initialRecurringRuleCount
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'recurring_rule.create' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /recurring-rules returns the created recurring rule item shape', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/recurring-rules', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        amountWon: 75000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 10,
        startDate: '2026-03-10',
        isActive: true
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'rr-3',
      title: 'Phone bill',
      amountWon: 75000,
      frequency: RecurrenceFrequency.MONTHLY,
      nextRunDate: '2026-03-10',
      fundingAccountName: 'Main checking',
      categoryName: 'Fuel',
      isActive: true
    });
    assert.equal(context.state.recurringRules.length, 3);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'recurring_rule.create' &&
          candidate.details.recurringRuleId === 'rr-3'
      )
    );
  } finally {
    await context.close();
  }
});

test('GET /recurring-rules/:id returns the recurring rule detail without ownership fields', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/recurring-rules/rr-seed-1', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'rr-seed-1',
      title: 'Phone bill',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1c',
      amountWon: 75_000,
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 10,
      startDate: '2026-03-10',
      endDate: null,
      nextRunDate: '2026-03-10',
      isActive: true
    });
    assert.equal(
      'tenantId' in (response.body as Record<string, unknown>),
      false
    );
    assert.equal(
      'ledgerId' in (response.body as Record<string, unknown>),
      false
    );
  } finally {
    await context.close();
  }
});

test('PATCH /recurring-rules/:id updates the recurring rule and returns the shared item shape', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/recurring-rules/rr-seed-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill revised',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        amountWon: 88_000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 15,
        startDate: '2026-03-15',
        endDate: '2026-12-15',
        isActive: false
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'rr-seed-1',
      title: 'Phone bill revised',
      amountWon: 88_000,
      frequency: RecurrenceFrequency.MONTHLY,
      nextRunDate: '2026-03-15',
      fundingAccountName: 'Main checking',
      categoryName: 'Fuel',
      isActive: false
    });
    assert.deepEqual(
      context.state.recurringRules.find(
        (candidate) => candidate.id === 'rr-seed-1'
      ),
      {
        id: 'rr-seed-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        title: 'Phone bill revised',
        amountWon: 88_000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 15,
        startDate: new Date('2026-03-15T00:00:00.000Z'),
        endDate: new Date('2026-12-15T00:00:00.000Z'),
        isActive: false,
        nextRunDate: new Date('2026-03-15T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
        updatedAt: context.state.recurringRules.find(
          (candidate) => candidate.id === 'rr-seed-1'
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
          candidate.details.action === 'recurring_rule.update' &&
          candidate.details.recurringRuleId === 'rr-seed-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('PATCH /recurring-rules/:id returns 403 when the current membership role cannot update recurring rules', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/recurring-rules/rr-seed-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill revised',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        amountWon: 88_000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 15,
        startDate: '2026-03-15',
        isActive: false
      }
    });

    assert.equal(response.status, 403);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'recurring_rule.update' &&
          candidate.details.recurringRuleId === 'rr-seed-1' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});

test('DELETE /recurring-rules/:id deletes the recurring rule and clears linked plan items', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.planItems.push({
      id: 'plan-from-rule-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-1',
      recurringRuleId: 'rr-seed-1',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1c',
      title: 'Phone bill plan',
      plannedAmount: 75_000,
      plannedDate: new Date('2026-03-10T00:00:00.000Z'),
      status: PlanItemStatus.DRAFT,
      createdAt: new Date('2026-03-01T09:00:00.000Z'),
      updatedAt: new Date('2026-03-01T09:00:00.000Z')
    });

    const response = await context.request('/recurring-rules/rr-seed-1', {
      method: 'DELETE',
      headers: context.authHeaders()
    });

    assert.equal(response.status, 204);
    assert.equal(response.body, null);
    assert.equal(
      context.state.recurringRules.some(
        (candidate) => candidate.id === 'rr-seed-1'
      ),
      false
    );
    assert.equal(
      context.state.planItems.find(
        (candidate) => candidate.id === 'plan-from-rule-1'
      )?.recurringRuleId,
      null
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'recurring_rule.delete' &&
          candidate.details.recurringRuleId === 'rr-seed-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('DELETE /recurring-rules/:id returns 403 when the current membership role cannot delete recurring rules', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/recurring-rules/rr-seed-1', {
      method: 'DELETE',
      headers: context.authHeaders()
    });

    assert.equal(response.status, 403);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'recurring_rule.delete' &&
          candidate.details.recurringRuleId === 'rr-seed-1' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});
