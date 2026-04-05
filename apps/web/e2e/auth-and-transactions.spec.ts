import { expect, test } from '@playwright/test';
import type {
  AccountingPeriodItem,
  AccountSubjectItem,
  AuthenticatedUser,
  CategoryItem,
  CollectedTransactionItem,
  CreateCategoryRequest,
  CreateCollectedTransactionRequest,
  CreateFundingAccountRequest,
  CreateRecurringRuleRequest,
  FundingAccountItem,
  LedgerTransactionTypeItem,
  RecurringRuleDetailItem,
  RecurringRuleItem,
  ReferenceDataReadinessSummary,
  UpdateCategoryRequest,
  UpdateFundingAccountRequest,
  UpdateRecurringRuleRequest
} from '@personal-erp/contracts';

const e2eApiRoutePattern = '**/api/**';

function expectNoPageErrors(pageErrors: string[]) {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
}

function expectNoUnhandledApiRequests(unhandledApiRequests: string[]) {
  expect(unhandledApiRequests, unhandledApiRequests.join('\n\n')).toEqual([]);
}

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
    await expect(page).toHaveURL(/\/login/);
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
  await expect(page.getByRole('button', { name: '문맥 상세' })).toBeVisible();
  await page.getByRole('button', { name: '문맥 상세' }).click();
  await expect(page.getByText('현재 작업 문맥 상세')).toBeVisible();
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

test('manages funding accounts and categories through the reference data UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const newFundingAccountName = `E2E 자금수단 ${Date.now()}`;
  const renamedFundingAccountName = `${newFundingAccountName} 수정`;
  const newCategoryName = `E2E 카테고리 ${Date.now()}`;
  const renamedCategoryName = `${newCategoryName} 수정`;
  const currentUser = createE2ECurrentUser();
  let sessionActive = false;
  let fundingAccounts = createE2EFundingAccounts();
  let categories = createE2ECategories();
  const accountSubjects = createE2EAccountSubjects();
  const ledgerTransactionTypes = createE2ELedgerTransactionTypes();

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

    if (
      path === '/api/reference-data/readiness' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildReferenceDataReadinessSummary({
            fundingAccounts,
            categories
          })
        )
      });
      return;
    }

    if (path === '/api/funding-accounts' && request.method() === 'GET') {
      const includeInactive =
        url.searchParams.get('includeInactive') === 'true';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          includeInactive
            ? fundingAccounts
            : fundingAccounts.filter(
                (fundingAccount) => fundingAccount.status === 'ACTIVE'
              )
        )
      });
      return;
    }

    if (path === '/api/funding-accounts' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateFundingAccountRequest;
      const created: FundingAccountItem = {
        id: `acc-e2e-${Date.now()}`,
        name: payload.name,
        type: payload.type,
        balanceWon: 0,
        status: 'ACTIVE'
      };

      fundingAccounts = [...fundingAccounts, created];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (
      path.startsWith('/api/funding-accounts/') &&
      request.method() === 'PATCH'
    ) {
      const fundingAccountId = path.split('/').at(-1);
      const payload = request.postDataJSON() as UpdateFundingAccountRequest;
      fundingAccounts = fundingAccounts.map((fundingAccount) =>
        fundingAccount.id === fundingAccountId
          ? {
              ...fundingAccount,
              name: payload.name,
              status: payload.status ?? fundingAccount.status
            }
          : fundingAccount
      );
      const updated =
        fundingAccounts.find(
          (fundingAccount) => fundingAccount.id === fundingAccountId
        ) ?? null;

      if (!updated) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Funding account not found' })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (path === '/api/categories' && request.method() === 'GET') {
      const includeInactive =
        url.searchParams.get('includeInactive') === 'true';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          includeInactive
            ? categories
            : categories.filter((category) => category.isActive)
        )
      });
      return;
    }

    if (path === '/api/categories' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateCategoryRequest;
      const created: CategoryItem = {
        id: `cat-e2e-${Date.now()}`,
        name: payload.name,
        kind: payload.kind,
        isActive: true
      };

      categories = [...categories, created];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (path.startsWith('/api/categories/') && request.method() === 'PATCH') {
      const categoryId = path.split('/').at(-1);
      const payload = request.postDataJSON() as UpdateCategoryRequest;
      categories = categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              name: payload.name,
              isActive: payload.isActive ?? category.isActive
            }
          : category
      );
      const updated =
        categories.find((category) => category.id === categoryId) ?? null;

      if (!updated) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Category not found' })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (path === '/api/account-subjects' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accountSubjects)
      });
      return;
    }

    if (
      path === '/api/ledger-transaction-types' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ledgerTransactionTypes)
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

  await page.goto('/reference-data');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/reference-data$/);
  await expect(
    page.getByRole('heading', { name: '기준 데이터와 참조 입력' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '자금수단 추가' })
  ).toBeVisible();

  await page.getByRole('button', { name: '자금수단 추가' }).click();
  await expect(
    page.getByRole('heading', { name: '자금수단 추가' })
  ).toBeVisible();
  await page.getByLabel('자금수단 이름').fill(newFundingAccountName);
  await page
    .locator('form')
    .getByRole('button', { name: '자금수단 추가' })
    .click();

  await expect(
    page.getByText(`${newFundingAccountName} 자금수단을 추가했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: newFundingAccountName, exact: true })
  ).toBeVisible();

  const newFundingAccountRow = page.getByRole('row', {
    name: new RegExp(newFundingAccountName)
  });
  await newFundingAccountRow.getByRole('button', { name: '수정' }).click();
  await page.getByLabel('자금수단 이름').fill(renamedFundingAccountName);
  await page
    .locator('form')
    .getByRole('button', { name: '자금수단 저장' })
    .click();

  await expect(
    page.getByText(`${renamedFundingAccountName} 자금수단을 저장했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', {
      name: renamedFundingAccountName,
      exact: true
    })
  ).toBeVisible();

  const renamedFundingAccountRow = page.getByRole('row', {
    name: new RegExp(renamedFundingAccountName)
  });
  await renamedFundingAccountRow
    .getByRole('button', { name: '비활성화' })
    .click();
  await expect(
    page.getByRole('heading', { name: '자금수단 비활성화' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '비활성화', exact: true })
    .click();

  await expect(
    page.getByText(`${renamedFundingAccountName} 자금수단을 비활성화했습니다.`)
  ).toBeVisible();
  await expect(
    renamedFundingAccountRow.getByText('비활성', { exact: true })
  ).toBeVisible();

  await renamedFundingAccountRow
    .getByRole('button', { name: '재활성화' })
    .click();
  await expect(
    page.getByRole('heading', { name: '자금수단 재활성화' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '재활성화', exact: true })
    .click();

  await expect(
    page.getByText(
      `${renamedFundingAccountName} 자금수단을 다시 활성화했습니다.`
    )
  ).toBeVisible();
  await expect(
    renamedFundingAccountRow.getByText('활성', { exact: true })
  ).toBeVisible();

  await renamedFundingAccountRow
    .getByRole('button', { name: '비활성화' })
    .click();
  await expect(
    page.getByRole('heading', { name: '자금수단 비활성화' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '비활성화', exact: true })
    .click();

  await expect(
    page.getByText(`${renamedFundingAccountName} 자금수단을 비활성화했습니다.`)
  ).toBeVisible();
  await expect(
    renamedFundingAccountRow.getByText('비활성', { exact: true })
  ).toBeVisible();

  await renamedFundingAccountRow.getByRole('button', { name: '종료' }).click();
  await expect(
    page.getByRole('heading', { name: '자금수단 종료' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '종료', exact: true })
    .click();

  await expect(
    page.getByText(`${renamedFundingAccountName} 자금수단을 종료했습니다.`)
  ).toBeVisible();
  await expect(
    renamedFundingAccountRow.getByText('종료', { exact: true })
  ).toBeVisible();
  await expect(
    renamedFundingAccountRow.getByText('종료 계정은 읽기 전용')
  ).toBeVisible();

  await page.getByRole('button', { name: '카테고리 추가' }).click();
  await expect(
    page.getByRole('heading', { name: '카테고리 추가' })
  ).toBeVisible();
  await page.getByLabel('카테고리 이름').fill(newCategoryName);
  await page
    .locator('form')
    .getByRole('button', { name: '카테고리 추가' })
    .click();

  await expect(
    page.getByText(`${newCategoryName} 카테고리를 추가했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: newCategoryName, exact: true })
  ).toBeVisible();

  const newCategoryRow = page.getByRole('row', {
    name: new RegExp(newCategoryName)
  });
  await newCategoryRow.getByRole('button', { name: '수정' }).click();
  await page.getByLabel('카테고리 이름').fill(renamedCategoryName);
  await page
    .locator('form')
    .getByRole('button', { name: '카테고리 저장' })
    .click();

  await expect(
    page.getByText(`${renamedCategoryName} 카테고리를 저장했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: renamedCategoryName, exact: true })
  ).toBeVisible();

  const renamedCategoryRow = page.getByRole('row', {
    name: new RegExp(renamedCategoryName)
  });
  await renamedCategoryRow.getByRole('button', { name: '비활성화' }).click();
  await expect(
    page.getByRole('heading', { name: '카테고리 비활성화' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '비활성화', exact: true })
    .click();

  await expect(
    page.getByText(`${renamedCategoryName} 카테고리를 비활성화했습니다.`)
  ).toBeVisible();
  await expect(
    renamedCategoryRow.getByText('비활성', { exact: true })
  ).toBeVisible();

  await renamedCategoryRow.getByRole('button', { name: '재활성화' }).click();
  await expect(
    page.getByRole('heading', { name: '카테고리 재활성화' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '재활성화', exact: true })
    .click();

  await expect(
    page.getByText(`${renamedCategoryName} 카테고리를 다시 활성화했습니다.`)
  ).toBeVisible();
  await expect(
    renamedCategoryRow.getByText('활성', { exact: true })
  ).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

test('manages recurring rules through the recurring rules UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const newRecurringRuleTitle = `E2E 반복 규칙 ${Date.now()}`;
  const renamedRecurringRuleTitle = `${newRecurringRuleTitle} 수정`;
  const currentUser = createE2ECurrentUser();
  let sessionActive = false;
  const fundingAccounts = createE2EFundingAccounts();
  const categories = createE2ECategories();
  let recurringRules = createE2ERecurringRules();

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

    if (path === '/api/recurring-rules' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recurringRules)
      });
      return;
    }

    if (path === '/api/recurring-rules' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateRecurringRuleRequest;
      const created = buildRecurringRuleItemFromPayload(payload, {
        id: `rr-e2e-${Date.now()}`,
        fundingAccounts,
        categories
      });

      recurringRules = mergeRecurringRulesForE2E(recurringRules, created);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (
      path.startsWith('/api/recurring-rules/') &&
      request.method() === 'GET'
    ) {
      const recurringRuleId = path.split('/').at(-1) ?? '';
      const detail = buildRecurringRuleDetailFromItem(
        recurringRules.find((rule) => rule.id === recurringRuleId) ?? null,
        {
          fundingAccounts,
          categories
        }
      );

      if (!detail) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Recurring rule not found' })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detail)
      });
      return;
    }

    if (
      path.startsWith('/api/recurring-rules/') &&
      request.method() === 'PATCH'
    ) {
      const recurringRuleId = path.split('/').at(-1) ?? '';
      const payload = request.postDataJSON() as UpdateRecurringRuleRequest;
      const updated = buildRecurringRuleItemFromPayload(payload, {
        id: recurringRuleId,
        fundingAccounts,
        categories
      });

      recurringRules = mergeRecurringRulesForE2E(recurringRules, updated);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (
      path.startsWith('/api/recurring-rules/') &&
      request.method() === 'DELETE'
    ) {
      const recurringRuleId = path.split('/').at(-1);
      recurringRules = recurringRules.filter(
        (rule) => rule.id !== recurringRuleId
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'null'
      });
      return;
    }

    if (path === '/api/funding-accounts' && request.method() === 'GET') {
      const includeInactive =
        url.searchParams.get('includeInactive') === 'true';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          includeInactive
            ? fundingAccounts
            : fundingAccounts.filter(
                (fundingAccount) => fundingAccount.status === 'ACTIVE'
              )
        )
      });
      return;
    }

    if (path === '/api/categories' && request.method() === 'GET') {
      const includeInactive =
        url.searchParams.get('includeInactive') === 'true';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          includeInactive
            ? categories
            : categories.filter((category) => category.isActive)
        )
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

  await page.goto('/recurring');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/recurring$/);
  await expect(page.getByRole('heading', { name: '반복 규칙' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '반복 규칙 등록' }).first()
  ).toBeVisible();

  await page.getByRole('button', { name: '반복 규칙 등록' }).first().click();
  await expect(
    page.getByRole('heading', { name: '반복 규칙 등록' })
  ).toBeVisible();
  await page.getByLabel('규칙명').fill(newRecurringRuleTitle);
  await page.getByLabel('금액 (원)').fill('88888');
  await page.getByLabel('시작일').fill('2026-04-15');
  await page
    .locator('form')
    .getByRole('button', { name: '반복 규칙 저장' })
    .click();

  await expect(
    page.getByText(`${newRecurringRuleTitle} 반복 규칙을 등록했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: newRecurringRuleTitle, exact: true })
  ).toBeVisible();

  const newRecurringRuleRow = page.getByRole('row', {
    name: new RegExp(newRecurringRuleTitle)
  });
  await newRecurringRuleRow.getByRole('button', { name: '수정' }).click();
  await expect(
    page.getByRole('heading', { name: '반복 규칙 수정' })
  ).toBeVisible();
  await page.getByLabel('규칙명').fill(renamedRecurringRuleTitle);
  await page.locator('form').getByRole('combobox', { name: '상태' }).click();
  await page.getByRole('option', { name: '일시중지' }).click();
  await page
    .locator('form')
    .getByRole('button', { name: '반복 규칙 수정' })
    .click();

  await expect(
    page.getByText(`${renamedRecurringRuleTitle} 반복 규칙을 수정했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', {
      name: renamedRecurringRuleTitle,
      exact: true
    })
  ).toBeVisible();
  const renamedRecurringRuleRow = page.getByRole('row', {
    name: new RegExp(renamedRecurringRuleTitle)
  });
  await expect(
    renamedRecurringRuleRow.getByText('중지', { exact: true })
  ).toBeVisible();

  await renamedRecurringRuleRow.getByRole('button', { name: '삭제' }).click();
  await expect(
    page.getByRole('heading', { name: '반복 규칙 삭제' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '삭제', exact: true })
    .click();

  await expect(
    page.getByText(`${renamedRecurringRuleTitle} 반복 규칙을 삭제했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', {
      name: renamedRecurringRuleTitle,
      exact: true
    })
  ).toHaveCount(0);

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

test('@smoke surfaces operational checklist guidance across empty states and readiness gaps', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const currentUser = createE2ECurrentUser();
  const fundingAccounts: FundingAccountItem[] = [];
  const categories: CategoryItem[] = [];
  const accountSubjects = createE2EAccountSubjects();
  const ledgerTransactionTypes = createE2ELedgerTransactionTypes();
  const readiness = buildReferenceDataReadinessSummary({
    fundingAccounts,
    categories
  });
  let sessionActive = false;

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

    if (path === '/api/dashboard/summary' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null)
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
        body: JSON.stringify(null)
      });
      return;
    }

    if (path === '/api/accounting-periods' && request.method() === 'GET') {
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
        body: JSON.stringify([])
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

    if (
      path === '/api/reference-data/readiness' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(readiness)
      });
      return;
    }

    if (path === '/api/funding-accounts' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
      return;
    }

    if (path === '/api/categories' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
      return;
    }

    if (path === '/api/account-subjects' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accountSubjects)
      });
      return;
    }

    if (
      path === '/api/ledger-transaction-types' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ledgerTransactionTypes)
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

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: '월 운영 대시보드' })
  ).toBeVisible();
  await expect(page.getByText('운영 기간이 아직 없습니다')).toBeVisible();
  await page.getByRole('link', { name: '운영 월 보기' }).click();
  await expect(page).toHaveURL(/\/periods$/);
  await expect(
    page.getByRole('heading', { name: '운영 기간 관리' })
  ).toBeVisible();

  await page.goto('/transactions');
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByText(
      '수집 거래 입력 전에 기준 데이터 준비를 먼저 점검해야 합니다.'
    )
  ).toBeVisible();
  await expect(
    page.getByText('현재 부족한 항목: 자금수단, 수입 카테고리, 지출 카테고리.')
  ).toBeVisible();
  await expect(
    page.getByText(
      '현재 열린 운영 기간이 없습니다. 먼저 `월 운영` 화면에서 월을 시작해 주세요.'
    )
  ).toBeVisible();
  await page.getByRole('link', { name: '기준 데이터 확인' }).click();
  await expect(page).toHaveURL(/\/reference-data$/);
  await expect(
    page.getByRole('heading', { name: '기준 데이터와 참조 입력' })
  ).toBeVisible();
  await expect(
    page.getByText(
      '기준 데이터 준비가 아직 완전하지 않습니다. 현재 부족한 항목: 자금수단, 수입 카테고리, 지출 카테고리.'
    )
  ).toBeVisible();
  await expect(page.getByText('0개 / 1개').first()).toBeVisible();

  await page.goto('/financial-statements');
  await expect(page).toHaveURL(/\/financial-statements$/);
  await expect(page.getByText('표시할 재무제표가 없습니다')).toBeVisible();
  await page.getByRole('link', { name: '운영 월 보기' }).click();
  await expect(page).toHaveURL(/\/periods$/);

  await page.goto('/carry-forwards');
  await expect(page).toHaveURL(/\/carry-forwards$/);
  await expect(page.getByText('표시할 차기 이월이 없습니다')).toBeVisible();
  await page.getByRole('link', { name: '재무제표 보기' }).first().click();
  await expect(page).toHaveURL(/\/financial-statements$/);

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

test('@smoke shows safe context fallback when no workspace is connected', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const currentUser = createE2ECurrentUserWithoutWorkspace();
  let sessionActive = false;

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  await page.route(e2eApiRoutePattern, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

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

    if (path === '/api/dashboard/summary' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null)
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

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('연결된 사업장 없음').first()).toBeVisible();

  await page.getByRole('button', { name: '문맥 상세' }).click();
  await expect(
    page.getByText(
      '아직 현재 사업장/장부 문맥이 연결되지 않았습니다. 설정 화면에서 로그인 상태와 현재 워크스페이스 구성을 먼저 확인해 주세요.'
    )
  ).toBeVisible();
  await page.getByRole('link', { name: '설정으로 이동' }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole('heading', { name: '현재 작업 문맥' }).first()
  ).toBeVisible();
  await expect(page.getByLabel('사업장 이름')).toHaveValue(
    '연결된 사업장 없음'
  );

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

function createE2ECurrentUser(): AuthenticatedUser {
  return {
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
}

function createE2ECurrentUserWithoutWorkspace(): AuthenticatedUser {
  return {
    ...createE2ECurrentUser(),
    currentWorkspace: null
  };
}

function createE2EFundingAccounts(): FundingAccountItem[] {
  return [
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
}

function createE2ECategories(): CategoryItem[] {
  return [
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
}

function createE2EAccountSubjects(): AccountSubjectItem[] {
  return [
    {
      id: 'as-1010',
      code: '1010',
      name: '현금및예금',
      statementType: 'BALANCE_SHEET',
      normalSide: 'DEBIT',
      subjectKind: 'ASSET',
      isSystem: true,
      isActive: true
    },
    {
      id: 'as-4100',
      code: '4100',
      name: '운영수익',
      statementType: 'PROFIT_AND_LOSS',
      normalSide: 'CREDIT',
      subjectKind: 'INCOME',
      isSystem: true,
      isActive: true
    }
  ];
}

function createE2ELedgerTransactionTypes(): LedgerTransactionTypeItem[] {
  return [
    {
      id: 'ltt-income-basic',
      code: 'INCOME_BASIC',
      name: '기본 수입',
      flowKind: 'INCOME',
      postingPolicyKey: 'INCOME_BASIC',
      isActive: true
    },
    {
      id: 'ltt-expense-basic',
      code: 'EXPENSE_BASIC',
      name: '기본 지출',
      flowKind: 'EXPENSE',
      postingPolicyKey: 'EXPENSE_BASIC',
      isActive: true
    }
  ];
}

function createE2ERecurringRules(): RecurringRuleItem[] {
  return [
    {
      id: 'rr-seed-1',
      title: '월세 자동 이체',
      amountWon: 1_200_000,
      frequency: 'MONTHLY',
      nextRunDate: '2026-04-05',
      fundingAccountName: '사업 운영 통장',
      categoryName: '원재료비',
      isActive: true
    }
  ];
}

function buildRecurringRuleItemFromPayload(
  payload: CreateRecurringRuleRequest | UpdateRecurringRuleRequest,
  input: {
    id: string;
    fundingAccounts: FundingAccountItem[];
    categories: CategoryItem[];
  }
): RecurringRuleItem {
  const fundingAccountName =
    input.fundingAccounts.find(
      (fundingAccount) => fundingAccount.id === payload.fundingAccountId
    )?.name ?? '-';
  const categoryName =
    input.categories.find((category) => category.id === payload.categoryId)
      ?.name ?? '-';

  return {
    id: input.id,
    title: payload.title,
    amountWon: payload.amountWon,
    frequency: payload.frequency,
    nextRunDate: payload.startDate,
    fundingAccountName,
    categoryName,
    isActive: payload.isActive ?? true
  };
}

function buildRecurringRuleDetailFromItem(
  recurringRule: RecurringRuleItem | null,
  input: {
    fundingAccounts: FundingAccountItem[];
    categories: CategoryItem[];
  }
): RecurringRuleDetailItem | null {
  if (!recurringRule) {
    return null;
  }

  const fundingAccountId =
    input.fundingAccounts.find(
      (fundingAccount) =>
        fundingAccount.name === recurringRule.fundingAccountName
    )?.id ?? input.fundingAccounts[0]?.id;
  const categoryId =
    input.categories.find(
      (category) => category.name === recurringRule.categoryName
    )?.id ?? null;

  if (!fundingAccountId) {
    return null;
  }

  return {
    id: recurringRule.id,
    title: recurringRule.title,
    fundingAccountId,
    categoryId,
    amountWon: recurringRule.amountWon,
    frequency: recurringRule.frequency,
    dayOfMonth: 15,
    startDate: recurringRule.nextRunDate ?? '2026-04-15',
    endDate: null,
    nextRunDate: recurringRule.nextRunDate,
    isActive: recurringRule.isActive
  };
}

function mergeRecurringRulesForE2E(
  current: RecurringRuleItem[],
  nextItem: RecurringRuleItem
) {
  return [nextItem, ...current.filter((item) => item.id !== nextItem.id)].sort(
    (left, right) => {
      if (left.isActive !== right.isActive) {
        return Number(right.isActive) - Number(left.isActive);
      }

      return (left.nextRunDate ?? '9999-12-31').localeCompare(
        right.nextRunDate ?? '9999-12-31'
      );
    }
  );
}

function buildReferenceDataReadinessSummary(input: {
  fundingAccounts: FundingAccountItem[];
  categories: CategoryItem[];
}): ReferenceDataReadinessSummary {
  const activeFundingAccountCount = input.fundingAccounts.filter(
    (fundingAccount) => fundingAccount.status === 'ACTIVE'
  ).length;
  const activeIncomeCategoryCount = input.categories.filter(
    (category) => category.kind === 'INCOME' && category.isActive
  ).length;
  const activeExpenseCategoryCount = input.categories.filter(
    (category) => category.kind === 'EXPENSE' && category.isActive
  ).length;

  const missingRequirements: string[] = [];
  if (activeFundingAccountCount < 1) {
    missingRequirements.push('자금수단');
  }
  if (activeIncomeCategoryCount < 1) {
    missingRequirements.push('수입 카테고리');
  }
  if (activeExpenseCategoryCount < 1) {
    missingRequirements.push('지출 카테고리');
  }
  const allChecksReady = missingRequirements.length === 0;

  return {
    status: allChecksReady ? 'READY' : 'ACTION_REQUIRED',
    currentRole: 'OWNER',
    isReadyForMonthlyOperation: allChecksReady,
    isReadyForTransactionEntry: allChecksReady,
    isReadyForImportCollection: allChecksReady,
    isReadyForRecurringRuleSetup: allChecksReady,
    missingRequirements,
    checks: [
      {
        key: 'funding-accounts',
        label: '자금수단',
        description:
          '수집 거래, 반복 규칙, 업로드 승격에서 실제 자금 흐름 계정으로 선택하는 기준 목록입니다.',
        ready: activeFundingAccountCount >= 1,
        count: activeFundingAccountCount,
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
        ready: activeIncomeCategoryCount >= 1,
        count: activeIncomeCategoryCount,
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
        ready: activeExpenseCategoryCount >= 1,
        count: activeExpenseCategoryCount,
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
        count: 2,
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
        count: 2,
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
}
