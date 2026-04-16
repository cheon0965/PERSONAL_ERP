import { expect, test } from '@playwright/test';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CategoryItem,
  CollectedTransactionItem,
  CreateCollectedTransactionRequest,
  FundingAccountItem,
  ReferenceDataReadinessSummary
} from '@personal-erp/contracts';
import {
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';

test('@smoke protects the transactions route, restores the session, and saves a transaction through the UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const transactionTitle = `E2E Transaction ${Date.now()}`;
  const businessDate = new Date().toISOString().slice(0, 10);
  const [businessYearToken, businessMonthToken] = businessDate.split('-');
  const currentPeriod: AccountingPeriodItem = {
    id: 'period-demo-current',
    year: Number(businessYearToken),
    month: Number(businessMonthToken),
    monthLabel: `${businessYearToken}-${businessMonthToken}`,
    startDate: `${businessYearToken}-${businessMonthToken}-01T00:00:00.000Z`,
    endDate: new Date(
      Date.UTC(Number(businessYearToken), Number(businessMonthToken), 1)
    ).toISOString(),
    status: 'OPEN',
    openedAt: `${businessYearToken}-${businessMonthToken}-01T00:00:00.000Z`,
    lockedAt: null,
    hasOpeningBalanceSnapshot: false,
    openingBalanceSourceKind: null,
    statusHistory: [
      {
        id: 'period-history-demo-open',
        fromStatus: null,
        toStatus: 'OPEN',
        eventType: 'OPEN',
        reason: 'Playwright smoke test setup',
        actorType: 'TENANT_MEMBERSHIP',
        actorMembershipId: 'membership-demo',
        changedAt: `${businessYearToken}-${businessMonthToken}-01T00:00:00.000Z`
      }
    ]
  };
  let sessionActive = false;

  const currentUser: AuthenticatedUser = {
    id: 'user-demo',
    email: 'demo@example.com',
    name: 'Demo User',
    currentWorkspace: {
      tenant: {
        id: 'tenant-demo',
        slug: 'demo-tenant',
        name: 'Demo Workspace',
        status: 'ACTIVE'
      },
      membership: {
        id: 'membership-demo',
        role: 'OWNER',
        status: 'ACTIVE'
      },
      ledger: {
        id: 'ledger-demo',
        name: '사업 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE'
      }
    }
  };

  const fundingAccounts: FundingAccountItem[] = [
    {
      id: 'acc-main',
      name: '사업 운영 통장',
      type: 'BANK',
      balanceWon: 2_450_000,
      status: 'ACTIVE'
    },
    {
      id: 'acc-reserve',
      name: '비용 예비 통장',
      type: 'BANK',
      balanceWon: 430_000,
      status: 'ACTIVE'
    }
  ];

  const categories: CategoryItem[] = [
    {
      id: 'cat-materials',
      name: '원재료비',
      kind: 'EXPENSE',
      isActive: true
    },
    {
      id: 'cat-sales',
      name: '매출 입금',
      kind: 'INCOME',
      isActive: true
    }
  ];
  const referenceDataReadiness: ReferenceDataReadinessSummary = {
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
        count: fundingAccounts.length,
        minimumRequiredCount: 1,
        ownershipScope: 'USER_MANAGED',
        responsibleRoles: ['OWNER', 'MANAGER'],
        inProductEditEnabled: true,
        operatingImpact:
          '없으면 수집 거래 등록과 업로드 행 승격에서 자금수단을 고를 수 없습니다.',
        managementNote:
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
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
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
      },
      {
        key: 'expense-categories',
        label: '지출 카테고리',
        description:
          '지출 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
        ready: true,
        count: 1,
        minimumRequiredCount: 1,
        ownershipScope: 'USER_MANAGED',
        responsibleRoles: ['OWNER', 'MANAGER'],
        inProductEditEnabled: true,
        operatingImpact:
          '없으면 지출 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
        managementNote:
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
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
  };

  let transactions: CollectedTransactionItem[] = [
    {
      id: 'txn-seeded-1',
      businessDate: '2026-03-12',
      title: '포장재 구매',
      type: 'EXPENSE',
      amountWon: 126_000,
      fundingAccountName: '비용 예비 통장',
      categoryName: '원재료비',
      sourceKind: 'MANUAL',
      postingStatus: 'POSTED',
      postedJournalEntryId: 'je-seeded-1',
      postedJournalEntryNumber: '202603-0001',
      matchedPlanItemId: null,
      matchedPlanItemTitle: null
    }
  ];

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  await page.route(e2eApiRoutePattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/auth/login' && request.method() === 'POST') {
      sessionActive = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'playwright-demo-access-token',
          user: currentUser
        })
      });
      return;
    }

    if (path === '/api/auth/refresh' && request.method() === 'POST') {
      if (!sessionActive) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Missing refresh token'
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'playwright-refreshed-access-token',
          user: currentUser
        })
      });
      return;
    }

    if (path === '/api/auth/logout' && request.method() === 'POST') {
      sessionActive = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'logged_out'
        })
      });
      return;
    }

    if (path === '/api/navigation/tree' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: []
        })
      });
      return;
    }

    if (path === '/api/funding-accounts' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fundingAccounts)
      });
      return;
    }

    if (path === '/api/categories' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(categories)
      });
      return;
    }

    if (
      path === '/api/reference-data/readiness' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(referenceDataReadiness)
      });
      return;
    }

    if (
      path === '/api/accounting-periods/current' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentPeriod)
      });
      return;
    }

    if (path === '/api/journal-entries' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
      return;
    }

    if (path === '/api/collected-transactions' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(transactions)
      });
      return;
    }

    if (path === '/api/collected-transactions' && request.method() === 'POST') {
      const payload =
        request.postDataJSON() as CreateCollectedTransactionRequest;
      const fundingAccountName =
        fundingAccounts.find(
          (fundingAccount) => fundingAccount.id === payload.fundingAccountId
        )?.name ?? '-';
      const categoryName =
        categories.find((category) => category.id === payload.categoryId)
          ?.name ?? '-';

      const createdItem: CollectedTransactionItem = {
        id: `txn-e2e-${Date.now()}`,
        businessDate: payload.businessDate,
        title: payload.title,
        type: payload.type,
        amountWon: payload.amountWon,
        fundingAccountName,
        categoryName,
        sourceKind: 'MANUAL',
        postingStatus: 'REVIEWED',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null,
        matchedPlanItemId: null,
        matchedPlanItemTitle: null
      };

      transactions = [createdItem, ...transactions];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdItem)
      });
      return;
    }

    if (
      path.startsWith('/api/collected-transactions/') &&
      request.method() === 'DELETE'
    ) {
      const collectedTransactionId = path.split('/').at(-1);
      transactions = transactions.filter(
        (candidate) => candidate.id !== collectedTransactionId
      );

      await route.fulfill({
        status: 204,
        body: ''
      });
      return;
    }

    const requestSignature = `${request.method()} ${path}`;
    unhandledApiRequests.push(requestSignature);

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        message: `Unhandled E2E route: ${requestSignature}`
      })
    });
  });

  await page.goto('/transactions');

  try {
    await expect(
      page.getByRole('heading', { name: '워크스페이스에 로그인' })
    ).toBeVisible();
  } catch (error) {
    throw new Error(
      [`Navigation to /login failed.`, ...pageErrors, String(error)].join(
        '\n\n'
      )
    );
  }

  await expect(
    page.getByRole('heading', { name: '워크스페이스에 로그인' })
  ).toBeVisible();

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole('heading', { level: 4, name: '수집 거래', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Demo User')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Demo Workspace / 사업 장부' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '문맥' })).toBeVisible();
  await page.getByRole('button', { name: '문맥' }).click();
  await expect(page.getByRole('link', { name: '운영 월' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.reload();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole('heading', { level: 4, name: '수집 거래', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Demo User')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Demo Workspace / 사업 장부' })
  ).toBeVisible();

  await page.getByRole('button', { name: '수집 거래 등록' }).click();
  await expect(
    page.getByRole('heading', { level: 6, name: '수집 거래 등록' })
  ).toBeVisible();

  await page.getByRole('textbox', { name: '적요' }).fill(transactionTitle);
  await page.getByRole('spinbutton', { name: '금액 (원)' }).fill('54321');
  await page
    .getByRole('textbox', { name: '거래일', exact: true })
    .fill(businessDate);

  const saveButton = page
    .locator('form')
    .getByRole('button', { name: '수집 거래 등록' });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(
    page.getByText(
      `${transactionTitle} 수집 거래를 등록했고 검토됨 상태로 반영했습니다.`
    )
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: transactionTitle, exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: '삭제' }).click();
  await expect(
    page.getByRole('heading', { name: '수집 거래 삭제' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '삭제', exact: true })
    .click();

  await expect(
    page.getByText(`${transactionTitle} 수집 거래를 삭제했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: transactionTitle, exact: true })
  ).toHaveCount(0);

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});
