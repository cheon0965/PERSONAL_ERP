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
          count: 5,
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
        id: 'as-1-3010',
        code: '3010',
        name: '사업자본',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'EQUITY',
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

test('POST /vehicles creates a vehicle for the current workspace when the membership can manage vehicle data', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/vehicles', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: '영업용 승합차',
        manufacturer: 'Kia',
        fuelType: 'HYBRID',
        initialOdometerKm: 12_400,
        monthlyExpenseWon: 215_000,
        estimatedFuelEfficiencyKmPerLiter: 14.8
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'vehicle-generated-3',
      name: '영업용 승합차',
      manufacturer: 'Kia',
      fuelType: 'HYBRID',
      initialOdometerKm: 12_400,
      monthlyExpenseWon: 215_000,
      estimatedFuelEfficiencyKmPerLiter: 14.8,
      fuelLogs: []
    });

    const createdVehicle = context.state.vehicles.find(
      (candidate) => candidate.id === 'vehicle-generated-3'
    );
    assert.ok(createdVehicle);
    assert.equal(createdVehicle.userId, 'user-1');
    assert.equal(createdVehicle.tenantId, 'tenant-1');
    assert.equal(createdVehicle.ledgerId, 'ledger-1');
    assert.equal(createdVehicle.name, '영업용 승합차');
    assert.equal(createdVehicle.manufacturer, 'Kia');
    assert.equal(createdVehicle.fuelType, 'HYBRID');
    assert.equal(createdVehicle.initialOdometerKm, 12_400);
    assert.equal(createdVehicle.monthlyExpenseWon, 215_000);
    assert.equal(createdVehicle.estimatedFuelEfficiencyKmPerLiter, 14.8);
    assert.equal(createdVehicle.fuelLogs.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /vehicles returns 403 when the current membership cannot create vehicles', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request('/vehicles', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: '영업용 승합차',
        fuelType: 'HYBRID',
        initialOdometerKm: 12_400,
        monthlyExpenseWon: 215_000
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('PATCH /vehicles/:id updates vehicle basic information for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/vehicles/vehicle-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: '배송 밴 플러스',
        manufacturer: 'Hyundai',
        fuelType: 'DIESEL',
        initialOdometerKm: 58_500,
        monthlyExpenseWon: 164_000,
        estimatedFuelEfficiencyKmPerLiter: 12.1
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'vehicle-1',
      name: '배송 밴 플러스',
      manufacturer: 'Hyundai',
      fuelType: 'DIESEL',
      initialOdometerKm: 58_500,
      monthlyExpenseWon: 164_000,
      estimatedFuelEfficiencyKmPerLiter: 12.1,
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
    });

    const updatedVehicle = context.state.vehicles.find(
      (candidate) => candidate.id === 'vehicle-1'
    );
    assert.ok(updatedVehicle);
    assert.equal(updatedVehicle.name, '배송 밴 플러스');
    assert.equal(updatedVehicle.manufacturer, 'Hyundai');
    assert.equal(updatedVehicle.fuelType, 'DIESEL');
    assert.equal(updatedVehicle.initialOdometerKm, 58_500);
    assert.equal(updatedVehicle.monthlyExpenseWon, 164_000);
    assert.equal(updatedVehicle.estimatedFuelEfficiencyKmPerLiter, 12.1);
    assert.equal(updatedVehicle.fuelLogs.length, 1);
  } finally {
    await context.close();
  }
});

test('PATCH /vehicles/:id returns 403 when the current membership cannot update vehicles', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/vehicles/vehicle-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: '배송 밴 플러스',
        manufacturer: 'Hyundai',
        fuelType: 'DIESEL',
        initialOdometerKm: 58_500,
        monthlyExpenseWon: 164_000,
        estimatedFuelEfficiencyKmPerLiter: 12.1
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('GET /vehicles/maintenance-logs returns only maintenance logs for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.vehicleMaintenanceLogs.push({
      id: 'maintenance-2',
      vehicleId: 'vehicle-2',
      performedOn: new Date('2026-03-21T00:00:00.000Z'),
      odometerKm: 12_640,
      category: 'INSPECTION',
      vendor: '기타 정비소',
      description: '엔진오일 점검',
      amountWon: 45_000,
      memo: null,
      createdAt: new Date('2026-03-21T09:00:00.000Z'),
      updatedAt: new Date('2026-03-21T09:00:00.000Z')
    });

    const response = await context.request('/vehicles/maintenance-logs', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'maintenance-1',
        vehicleId: 'vehicle-1',
        vehicleName: '배송 밴',
        performedOn: '2026-03-18',
        odometerKm: 58_620,
        category: 'REPAIR',
        vendor: '현대 블루핸즈',
        description: '브레이크 패드 교체',
        amountWon: 185_000,
        memo: '전륜 패드 기준'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /vehicles/:id/maintenance-logs creates a maintenance log for the current workspace vehicle', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          performedOn: '2026-03-25',
          odometerKm: 58_940,
          category: 'CONSUMABLE',
          vendor: '타이어프로',
          description: '앞 타이어 2본 교체',
          amountWon: 240_000,
          memo: '얼라인먼트 포함'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'maintenance-generated-2',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴',
      performedOn: '2026-03-25',
      odometerKm: 58_940,
      category: 'CONSUMABLE',
      vendor: '타이어프로',
      description: '앞 타이어 2본 교체',
      amountWon: 240_000,
      memo: '얼라인먼트 포함'
    });

    assert.deepEqual(
      context.state.vehicleMaintenanceLogs.find(
        (candidate) => candidate.id === 'maintenance-generated-2'
      ),
      {
        id: 'maintenance-generated-2',
        vehicleId: 'vehicle-1',
        performedOn: new Date('2026-03-25T00:00:00.000Z'),
        odometerKm: 58_940,
        category: 'CONSUMABLE',
        vendor: '타이어프로',
        description: '앞 타이어 2본 교체',
        amountWon: 240_000,
        memo: '얼라인먼트 포함',
        createdAt: context.state.vehicleMaintenanceLogs.find(
          (candidate) => candidate.id === 'maintenance-generated-2'
        )?.createdAt,
        updatedAt: context.state.vehicleMaintenanceLogs.find(
          (candidate) => candidate.id === 'maintenance-generated-2'
        )?.updatedAt
      }
    );
  } finally {
    await context.close();
  }
});

test('PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId updates a maintenance log for the current workspace vehicle', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs/maintenance-1',
      {
        method: 'PATCH',
        headers: context.authHeaders(),
        body: {
          performedOn: '2026-03-19',
          odometerKm: 58_700,
          category: 'REPAIR',
          vendor: '현대 블루핸즈 강남점',
          description: '브레이크 패드 및 디스크 점검',
          amountWon: 198_000,
          memo: '후속 정비 예약'
        }
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'maintenance-1',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴',
      performedOn: '2026-03-19',
      odometerKm: 58_700,
      category: 'REPAIR',
      vendor: '현대 블루핸즈 강남점',
      description: '브레이크 패드 및 디스크 점검',
      amountWon: 198_000,
      memo: '후속 정비 예약'
    });

    const updatedLog = context.state.vehicleMaintenanceLogs.find(
      (candidate) => candidate.id === 'maintenance-1'
    );
    assert.ok(updatedLog);
    assert.equal(
      updatedLog.performedOn.toISOString(),
      '2026-03-19T00:00:00.000Z'
    );
    assert.equal(updatedLog.odometerKm, 58_700);
    assert.equal(updatedLog.category, 'REPAIR');
    assert.equal(updatedLog.vendor, '현대 블루핸즈 강남점');
    assert.equal(updatedLog.description, '브레이크 패드 및 디스크 점검');
    assert.equal(updatedLog.amountWon, 198_000);
    assert.equal(updatedLog.memo, '후속 정비 예약');
  } finally {
    await context.close();
  }
});

test('POST /vehicles/:id/maintenance-logs returns 403 when the current membership cannot create maintenance logs', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          performedOn: '2026-03-25',
          odometerKm: 58_940,
          category: 'CONSUMABLE',
          description: '앞 타이어 2본 교체',
          amountWon: 240_000
        }
      }
    );

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});
