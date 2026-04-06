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
