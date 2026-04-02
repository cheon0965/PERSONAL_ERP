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
        balanceWon: 2_000_000
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000
      }
    ]);
  } finally {
    await context.close();
  }
});

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
        kind: 'INCOME'
      },
      {
        id: 'cat-1',
        name: 'Fuel',
        kind: 'EXPENSE'
      },
      {
        id: 'cat-1c',
        name: 'Utilities',
        kind: 'EXPENSE'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /account-subjects returns active account subjects for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/account-subjects', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'as-1-1010',
        code: '1010',
        name: '현금및예금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'DEBIT',
        subjectKind: 'ASSET',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-2010',
        code: '2010',
        name: '카드대금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'LIABILITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-4100',
        code: '4100',
        name: '운영수익',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'CREDIT',
        subjectKind: 'INCOME',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-5100',
        code: '5100',
        name: '운영비용',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'DEBIT',
        subjectKind: 'EXPENSE',
        isSystem: true,
        isActive: true
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /ledger-transaction-types returns active transaction types for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/ledger-transaction-types', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'ltt-1-income',
        code: 'INCOME_BASIC',
        name: '기본 수입',
        flowKind: 'INCOME',
        postingPolicyKey: 'INCOME_BASIC',
        isActive: true
      },
      {
        id: 'ltt-1-expense',
        code: 'EXPENSE_BASIC',
        name: '기본 지출',
        flowKind: 'EXPENSE',
        postingPolicyKey: 'EXPENSE_BASIC',
        isActive: true
      },
      {
        id: 'ltt-1-transfer',
        code: 'TRANSFER_BASIC',
        name: '기본 이체',
        flowKind: 'TRANSFER',
        postingPolicyKey: 'TRANSFER_BASIC',
        isActive: true
      }
    ]);
  } finally {
    await context.close();
  }
});

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
        maturityDate: null
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /vehicles returns only vehicles for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/vehicles', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'vehicle-1',
        name: '배송 밴',
        manufacturer: 'Hyundai',
        fuelType: 'DIESEL',
        initialOdometerKm: 58_200,
        monthlyExpenseWon: 130_000,
        estimatedFuelEfficiencyKmPerLiter: 11.2,
        fuelLogs: [
          {
            id: 'fuel-1',
            filledOn: '2026-03-05',
            odometerKm: 58_480,
            liters: 42.5,
            amountWon: 72_000,
            unitPriceWon: 1694,
            isFullTank: true
          }
        ]
      }
    ]);
  } finally {
    await context.close();
  }
});
