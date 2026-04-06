import assert from 'node:assert/strict';
import test from 'node:test';
import { RecurrenceFrequency } from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('GET /insurance-policies returns active policies with recurring linkage fields for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/insurance-policies', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'policy-1',
        provider: '삼성화재',
        productName: '업무용 차량 보험',
        monthlyPremiumWon: 42_000,
        paymentDay: 25,
        cycle: 'MONTHLY',
        fundingAccountId: 'acc-1',
        fundingAccountName: 'Main checking',
        categoryId: 'cat-1c',
        categoryName: 'Utilities',
        recurringStartDate: '2026-03-25',
        linkedRecurringRuleId: null,
        renewalDate: '2026-11-01',
        maturityDate: null,
        isActive: true
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /insurance-policies?includeInactive=true includes inactive policies and linkage fields for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.insurancePolicies.push({
      id: 'policy-1b',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      provider: '현대해상',
      productName: '화물 적재 보험',
      monthlyPremiumWon: 28_000,
      paymentDay: 12,
      cycle: 'MONTHLY',
      accountId: 'acc-1b',
      categoryId: 'cat-1',
      recurringStartDate: new Date('2026-08-12T00:00:00.000Z'),
      linkedRecurringRuleId: null,
      renewalDate: new Date('2026-08-20T00:00:00.000Z'),
      maturityDate: null,
      isActive: false
    });

    const response = await context.request(
      '/insurance-policies?includeInactive=true',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'policy-1',
        provider: '삼성화재',
        productName: '업무용 차량 보험',
        monthlyPremiumWon: 42_000,
        paymentDay: 25,
        cycle: 'MONTHLY',
        fundingAccountId: 'acc-1',
        fundingAccountName: 'Main checking',
        categoryId: 'cat-1c',
        categoryName: 'Utilities',
        recurringStartDate: '2026-03-25',
        linkedRecurringRuleId: null,
        renewalDate: '2026-11-01',
        maturityDate: null,
        isActive: true
      },
      {
        id: 'policy-1b',
        provider: '현대해상',
        productName: '화물 적재 보험',
        monthlyPremiumWon: 28_000,
        paymentDay: 12,
        cycle: 'MONTHLY',
        fundingAccountId: 'acc-1b',
        fundingAccountName: 'Emergency savings',
        categoryId: 'cat-1',
        categoryName: 'Fuel',
        recurringStartDate: '2026-08-12',
        linkedRecurringRuleId: null,
        renewalDate: '2026-08-20',
        maturityDate: null,
        isActive: false
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /insurance-policies creates an insurance policy and a linked recurring rule for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/insurance-policies', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        provider: '메리츠화재',
        productName: '사업장 배상 책임보험',
        monthlyPremiumWon: 58_000,
        paymentDay: 17,
        cycle: 'MONTHLY',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1c',
        recurringStartDate: '2026-03-17',
        renewalDate: '2026-12-01'
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'policy-generated-3',
      provider: '메리츠화재',
      productName: '사업장 배상 책임보험',
      monthlyPremiumWon: 58_000,
      paymentDay: 17,
      cycle: 'MONTHLY',
      fundingAccountId: 'acc-1',
      fundingAccountName: 'Main checking',
      categoryId: 'cat-1c',
      categoryName: 'Utilities',
      recurringStartDate: '2026-03-17',
      linkedRecurringRuleId: 'rr-3',
      renewalDate: '2026-12-01',
      maturityDate: null,
      isActive: true
    });

    const createdPolicy = context.state.insurancePolicies.find(
      (candidate) => candidate.id === 'policy-generated-3'
    );
    assert.deepEqual(createdPolicy, {
      id: 'policy-generated-3',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      provider: '메리츠화재',
      productName: '사업장 배상 책임보험',
      monthlyPremiumWon: 58_000,
      paymentDay: 17,
      cycle: 'MONTHLY',
      accountId: 'acc-1',
      categoryId: 'cat-1c',
      recurringStartDate: new Date('2026-03-17T00:00:00.000Z'),
      linkedRecurringRuleId: 'rr-3',
      renewalDate: new Date('2026-12-01T00:00:00.000Z'),
      maturityDate: null,
      isActive: true
    });

    const createdRecurringRule = context.state.recurringRules.find(
      (candidate) => candidate.id === 'rr-3'
    );
    assert.ok(createdRecurringRule);
    assert.equal(createdRecurringRule?.accountId, 'acc-1');
    assert.equal(createdRecurringRule?.categoryId, 'cat-1c');
    assert.equal(
      createdRecurringRule?.title,
      '메리츠화재 사업장 배상 책임보험'
    );
    assert.equal(createdRecurringRule?.amountWon, 58_000);
    assert.equal(createdRecurringRule?.frequency, RecurrenceFrequency.MONTHLY);
    assert.equal(createdRecurringRule?.dayOfMonth, 17);
    assert.deepEqual(
      createdRecurringRule?.startDate,
      new Date('2026-03-17T00:00:00.000Z')
    );
    assert.deepEqual(
      createdRecurringRule?.nextRunDate,
      new Date('2026-03-17T00:00:00.000Z')
    );
    assert.equal(createdRecurringRule?.endDate, null);
    assert.equal(createdRecurringRule?.isActive, true);
    assert.equal(context.state.recurringRules.length, 3);
  } finally {
    await context.close();
  }
});

test('POST /insurance-policies returns 403 when the current membership cannot create insurance policies', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request('/insurance-policies', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        provider: '메리츠화재',
        productName: '사업장 배상 책임보험',
        monthlyPremiumWon: 58_000,
        paymentDay: 17,
        cycle: 'MONTHLY',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1c',
        recurringStartDate: '2026-03-17'
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('PATCH /insurance-policies/:id updates an insurance policy and syncs its existing linked recurring rule', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.insurancePolicies[0] = {
      ...context.state.insurancePolicies[0]!,
      accountId: 'acc-1',
      categoryId: 'cat-1c',
      recurringStartDate: new Date('2026-03-25T00:00:00.000Z'),
      linkedRecurringRuleId: 'rr-policy-1'
    };
    context.state.recurringRules.push({
      id: 'rr-policy-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      accountId: 'acc-1',
      categoryId: 'cat-1c',
      title: '삼성화재 업무용 차량 보험',
      amountWon: 42_000,
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 25,
      startDate: new Date('2026-03-25T00:00:00.000Z'),
      endDate: null,
      isActive: true,
      nextRunDate: new Date('2026-03-25T00:00:00.000Z'),
      createdAt: new Date('2026-03-01T09:30:00.000Z'),
      updatedAt: new Date('2026-03-01T09:30:00.000Z')
    });

    const response = await context.request('/insurance-policies/policy-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        provider: '삼성화재',
        productName: '업무용 차량 보험 플러스',
        monthlyPremiumWon: 46_000,
        paymentDay: 27,
        cycle: 'YEARLY',
        fundingAccountId: 'acc-1b',
        categoryId: 'cat-1',
        recurringStartDate: '2026-03-27',
        renewalDate: '2026-12-05',
        maturityDate: '2027-12-05',
        isActive: false
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'policy-1',
      provider: '삼성화재',
      productName: '업무용 차량 보험 플러스',
      monthlyPremiumWon: 46_000,
      paymentDay: 27,
      cycle: 'YEARLY',
      fundingAccountId: 'acc-1b',
      fundingAccountName: 'Emergency savings',
      categoryId: 'cat-1',
      categoryName: 'Fuel',
      recurringStartDate: '2026-03-27',
      linkedRecurringRuleId: 'rr-policy-1',
      renewalDate: '2026-12-05',
      maturityDate: '2027-12-05',
      isActive: false
    });

    const updatedPolicy = context.state.insurancePolicies.find(
      (candidate) => candidate.id === 'policy-1'
    );
    assert.deepEqual(updatedPolicy, {
      id: 'policy-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      provider: '삼성화재',
      productName: '업무용 차량 보험 플러스',
      monthlyPremiumWon: 46_000,
      paymentDay: 27,
      cycle: 'YEARLY',
      accountId: 'acc-1b',
      categoryId: 'cat-1',
      recurringStartDate: new Date('2026-03-27T00:00:00.000Z'),
      linkedRecurringRuleId: 'rr-policy-1',
      renewalDate: new Date('2026-12-05T00:00:00.000Z'),
      maturityDate: new Date('2027-12-05T00:00:00.000Z'),
      isActive: false
    });

    const syncedRecurringRule = context.state.recurringRules.find(
      (candidate) => candidate.id === 'rr-policy-1'
    );
    assert.ok(syncedRecurringRule);
    assert.equal(syncedRecurringRule?.accountId, 'acc-1b');
    assert.equal(syncedRecurringRule?.categoryId, 'cat-1');
    assert.equal(
      syncedRecurringRule?.title,
      '삼성화재 업무용 차량 보험 플러스'
    );
    assert.equal(syncedRecurringRule?.amountWon, 46_000);
    assert.equal(syncedRecurringRule?.frequency, RecurrenceFrequency.YEARLY);
    assert.equal(syncedRecurringRule?.dayOfMonth, 27);
    assert.deepEqual(
      syncedRecurringRule?.startDate,
      new Date('2026-03-27T00:00:00.000Z')
    );
    assert.deepEqual(
      syncedRecurringRule?.endDate,
      new Date('2027-12-05T00:00:00.000Z')
    );
    assert.deepEqual(
      syncedRecurringRule?.nextRunDate,
      new Date('2026-03-27T00:00:00.000Z')
    );
    assert.equal(syncedRecurringRule?.isActive, false);
    assert.equal(context.state.recurringRules.length, 3);
  } finally {
    await context.close();
  }
});

test('PATCH /insurance-policies/:id can reactivate an inactive insurance policy and create a missing linked recurring rule', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.insurancePolicies.push({
      id: 'policy-1b',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      provider: '현대해상',
      productName: '화물 적재 보험',
      monthlyPremiumWon: 28_000,
      paymentDay: 12,
      cycle: 'MONTHLY',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      recurringStartDate: new Date('2026-08-12T00:00:00.000Z'),
      linkedRecurringRuleId: null,
      renewalDate: new Date('2026-08-20T00:00:00.000Z'),
      maturityDate: null,
      isActive: false
    });

    const response = await context.request('/insurance-policies/policy-1b', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        provider: '현대해상',
        productName: '화물 적재 보험',
        monthlyPremiumWon: 28_000,
        paymentDay: 12,
        cycle: 'MONTHLY',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        recurringStartDate: '2026-08-12',
        renewalDate: '2026-08-20',
        isActive: true
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'policy-1b',
      provider: '현대해상',
      productName: '화물 적재 보험',
      monthlyPremiumWon: 28_000,
      paymentDay: 12,
      cycle: 'MONTHLY',
      fundingAccountId: 'acc-1',
      fundingAccountName: 'Main checking',
      categoryId: 'cat-1',
      categoryName: 'Fuel',
      recurringStartDate: '2026-08-12',
      linkedRecurringRuleId: 'rr-3',
      renewalDate: '2026-08-20',
      maturityDate: null,
      isActive: true
    });

    const updatedPolicy = context.state.insurancePolicies.find(
      (candidate) => candidate.id === 'policy-1b'
    );
    assert.equal(updatedPolicy?.linkedRecurringRuleId, 'rr-3');
    assert.equal(updatedPolicy?.isActive, true);

    const createdRecurringRule = context.state.recurringRules.find(
      (candidate) => candidate.id === 'rr-3'
    );
    assert.ok(createdRecurringRule);
    assert.equal(createdRecurringRule?.title, '현대해상 화물 적재 보험');
    assert.equal(createdRecurringRule?.amountWon, 28_000);
    assert.equal(createdRecurringRule?.frequency, RecurrenceFrequency.MONTHLY);
    assert.equal(createdRecurringRule?.dayOfMonth, 12);
    assert.equal(createdRecurringRule?.isActive, true);
    assert.equal(context.state.recurringRules.length, 3);
  } finally {
    await context.close();
  }
});

test('PATCH /insurance-policies/:id returns 403 when the current membership cannot update insurance policies', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/insurance-policies/policy-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        provider: '삼성화재',
        productName: '업무용 차량 보험 플러스',
        monthlyPremiumWon: 46_000,
        paymentDay: 27,
        cycle: 'YEARLY',
        fundingAccountId: 'acc-1b',
        categoryId: 'cat-1',
        recurringStartDate: '2026-03-27',
        renewalDate: '2026-12-05',
        maturityDate: '2027-12-05',
        isActive: false
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('DELETE /insurance-policies/:id deletes the insurance policy and its linked recurring rule', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.insurancePolicies[0] = {
      ...context.state.insurancePolicies[0]!,
      linkedRecurringRuleId: 'rr-policy-1'
    };
    context.state.recurringRules.push({
      id: 'rr-policy-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      accountId: 'acc-1',
      categoryId: 'cat-1c',
      title: '삼성화재 업무용 차량 보험',
      amountWon: 42_000,
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 25,
      startDate: new Date('2026-03-25T00:00:00.000Z'),
      endDate: null,
      isActive: true,
      nextRunDate: new Date('2026-03-25T00:00:00.000Z'),
      createdAt: new Date('2026-03-01T09:30:00.000Z'),
      updatedAt: new Date('2026-03-01T09:30:00.000Z')
    });

    const response = await context.request('/insurance-policies/policy-1', {
      method: 'DELETE',
      headers: context.authHeaders()
    });

    assert.equal(response.status, 204);
    assert.equal(response.body, null);
    assert.equal(
      context.state.insurancePolicies.some(
        (candidate) => candidate.id === 'policy-1'
      ),
      false
    );
    assert.equal(
      context.state.recurringRules.some(
        (candidate) => candidate.id === 'rr-policy-1'
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
          candidate.details.action === 'insurance_policy.delete' &&
          candidate.details.insurancePolicyId === 'policy-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('DELETE /insurance-policies/:id returns 403 when the current membership cannot delete insurance policies', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/insurance-policies/policy-1', {
      method: 'DELETE',
      headers: context.authHeaders()
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});
