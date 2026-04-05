import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from './request-api.test-support';

test('GET /reference-data/readiness returns the current workspace preparation summary', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/reference-data/readiness', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: 'READY',
      currentRole: 'OWNER',
      isReadyForMonthlyOperation: true,
      isReadyForTransactionEntry: true,
      isReadyForImportCollection: true,
      isReadyForRecurringRuleSetup: true,
      missingRequirements: [],
      checks: [
        {
          key: 'funding-accounts',
          label: '자금수단',
          description:
            '수집 거래, 반복 규칙, 업로드 승격에서 실제 자금 흐름 계정으로 선택하는 기준 목록입니다.',
          ready: true,
          count: 2,
          minimumRequiredCount: 1,
          ownershipScope: 'USER_MANAGED',
          responsibleRoles: ['OWNER', 'MANAGER'],
          inProductEditEnabled: true,
          operatingImpact:
            '없으면 수집 거래 등록과 업로드 행 승격에서 자금수단을 고를 수 없습니다.',
          managementNote:
            '사용자 관리 데이터이며, 현재 제품에서는 직접 생성/이름 수정/활성 상태 관리를 지원합니다.'
        },
        {
          key: 'income-categories',
          label: '수입 카테고리',
          description:
            '수입 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
          ready: true,
          count: 1,
          minimumRequiredCount: 1,
          ownershipScope: 'USER_MANAGED',
          responsibleRoles: ['OWNER', 'MANAGER'],
          inProductEditEnabled: true,
          operatingImpact:
            '없으면 수입 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
          managementNote:
            '사용자 관리 데이터이며, 현재 제품에서는 직접 생성/이름 수정/활성 상태 관리를 지원합니다.'
        },
        {
          key: 'expense-categories',
          label: '지출 카테고리',
          description:
            '지출 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
          ready: true,
          count: 2,
          minimumRequiredCount: 1,
          ownershipScope: 'USER_MANAGED',
          responsibleRoles: ['OWNER', 'MANAGER'],
          inProductEditEnabled: true,
          operatingImpact:
            '없으면 지출 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
          managementNote:
            '사용자 관리 데이터이며, 현재 제품에서는 직접 생성/이름 수정/활성 상태 관리를 지원합니다.'
        },
        {
          key: 'account-subjects',
          label: '계정과목',
          description:
            '전표 라인, 월 마감, 재무제표 계산에 공통으로 쓰이는 공식 계정과목 목록입니다.',
          ready: true,
          count: 4,
          minimumRequiredCount: 1,
          ownershipScope: 'SYSTEM_MANAGED',
          responsibleRoles: [],
          inProductEditEnabled: false,
          operatingImpact:
            '없으면 전표 확정과 마감 계산이 일관되게 이어질 수 없습니다.',
          managementNote:
            '초기 범위에서는 system-managed/seed-managed 데이터로 유지합니다. 운영자는 직접 편집하지 않고 존재 여부와 활성 상태만 확인합니다.'
        },
        {
          key: 'ledger-transaction-types',
          label: '거래유형',
          description:
            '계획 항목과 수집 거래를 내부 전표 정책에 연결하는 공식 거래유형 목록입니다.',
          ready: true,
          count: 3,
          minimumRequiredCount: 1,
          ownershipScope: 'SYSTEM_MANAGED',
          responsibleRoles: [],
          inProductEditEnabled: false,
          operatingImpact:
            '없으면 계획/수집 거래를 전표 정책에 안정적으로 연결할 수 없습니다.',
          managementNote:
            '초기 범위에서는 system-managed/seed-managed 데이터로 유지합니다. 운영자는 직접 편집하지 않고 존재 여부와 활성 상태만 확인합니다.'
        }
      ]
    });
  } finally {
    await context.close();
  }
});

test('GET /reference-data/readiness reports missing preparation items when active reference data is absent', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts = [];
    context.state.categories = context.state.categories.filter(
      (candidate) => candidate.kind === 'INCOME'
    );

    const response = await context.request('/reference-data/readiness', {
      headers: context.authHeaders()
    });
    const summary = response.body as {
      status: string;
      missingRequirements: string[];
      isReadyForTransactionEntry: boolean;
      isReadyForImportCollection: boolean;
    };

    assert.equal(response.status, 200);
    assert.equal(summary.status, 'ACTION_REQUIRED');
    assert.deepEqual(summary.missingRequirements, [
      '자금수단',
      '지출 카테고리'
    ]);
    assert.equal(summary.isReadyForTransactionEntry, false);
    assert.equal(summary.isReadyForImportCollection, false);
  } finally {
    await context.close();
  }
});

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
