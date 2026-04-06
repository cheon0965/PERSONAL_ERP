import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from './request-api.test-support';

test('GET /insurance-policies returns active policies for the current workspace ledger', async () => {
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
        renewalDate: '2026-11-01',
        maturityDate: null,
        isActive: true
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /insurance-policies?includeInactive=true includes inactive policies for the current workspace ledger', async () => {
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
        renewalDate: '2026-08-20',
        maturityDate: null,
        isActive: false
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /insurance-policies creates an insurance policy for the current workspace when the membership can manage reference data', async () => {
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
      renewalDate: '2026-12-01',
      maturityDate: null,
      isActive: true
    });
    assert.deepEqual(
      context.state.insurancePolicies.find(
        (candidate) => candidate.id === 'policy-generated-3'
      ),
      {
        id: 'policy-generated-3',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        provider: '메리츠화재',
        productName: '사업장 배상 책임보험',
        monthlyPremiumWon: 58_000,
        paymentDay: 17,
        cycle: 'MONTHLY',
        renewalDate: new Date('2026-12-01T00:00:00.000Z'),
        maturityDate: null,
        isActive: true
      }
    );
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
        cycle: 'MONTHLY'
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('PATCH /insurance-policies/:id updates an insurance policy for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/insurance-policies/policy-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        provider: '삼성화재',
        productName: '업무용 차량 보험 플러스',
        monthlyPremiumWon: 46_000,
        paymentDay: 27,
        cycle: 'YEARLY',
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
      renewalDate: '2026-12-05',
      maturityDate: '2027-12-05',
      isActive: false
    });
    assert.deepEqual(
      context.state.insurancePolicies.find(
        (candidate) => candidate.id === 'policy-1'
      ),
      {
        id: 'policy-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        provider: '삼성화재',
        productName: '업무용 차량 보험 플러스',
        monthlyPremiumWon: 46_000,
        paymentDay: 27,
        cycle: 'YEARLY',
        renewalDate: new Date('2026-12-05T00:00:00.000Z'),
        maturityDate: new Date('2027-12-05T00:00:00.000Z'),
        isActive: false
      }
    );
  } finally {
    await context.close();
  }
});

test('PATCH /insurance-policies/:id can reactivate an inactive insurance policy for the current workspace', async () => {
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
      renewalDate: '2026-08-20',
      maturityDate: null,
      isActive: true
    });
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
