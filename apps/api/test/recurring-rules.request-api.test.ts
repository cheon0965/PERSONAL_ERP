import assert from 'node:assert/strict';
import test from 'node:test';
import { RecurrenceFrequency } from '@prisma/client';
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
