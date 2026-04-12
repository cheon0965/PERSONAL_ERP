import { expect, test } from '@playwright/test';
import type {
  AccountSubjectItem,
  AccountingPeriodItem,
  AuthenticatedUser,
  CategoryItem,
  CloseAccountingPeriodRequest,
  CloseAccountingPeriodResponse,
  CollectedTransactionItem,
  CorrectJournalEntryRequest,
  CreateCategoryRequest,
  CreateCollectedTransactionRequest,
  CreateFundingAccountRequest,
  CreateInsurancePolicyRequest,
  CreateRecurringRuleRequest,
  CreateVehicleFuelLogRequest,
  CreateVehicleMaintenanceLogRequest,
  CreateVehicleRequest,
  FundingAccountItem,
  JournalEntryItem,
  OpenAccountingPeriodRequest,
  ReferenceDataReadinessSummary,
  ReopenAccountingPeriodRequest,
  ReverseJournalEntryRequest,
  UpdateCategoryRequest,
  UpdateFundingAccountRequest,
  UpdateInsurancePolicyRequest,
  UpdateRecurringRuleRequest,
  UpdateVehicleFuelLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest
} from '@personal-erp/contracts';
import {
  buildInsurancePolicyItemFromPayload,
  buildInsuranceRecurringRuleItemFromPolicyPayload,
  buildRecurringRuleDetailFromItem,
  buildRecurringRuleItemFromPayload,
  buildReferenceDataReadinessSummary,
  buildVehicleFuelLogItemFromPayload,
  buildVehicleItemFromPayload,
  buildVehicleMaintenanceLogItemFromPayload,
  createE2EAccountSubjects,
  createE2ECategories,
  createE2ECurrentUser,
  createE2ECurrentUserWithoutWorkspace,
  createE2EFundingAccounts,
  createE2EInsurancePolicies,
  createE2ELedgerTransactionTypes,
  createE2ERecurringRules,
  createE2EVehicleFuelLogs,
  createE2EVehicleMaintenanceLogs,
  createE2EVehicles,
  mergeInsurancePoliciesForE2E,
  mergeRecurringRulesForE2E,
  mergeVehicleFuelLogsForE2E,
  mergeVehicleMaintenanceLogsForE2E,
  mergeVehiclesForE2E
} from './support/auth-transactions-fixtures';
import { buildVehicleOperatingSummaryView } from '../src/features/vehicles/vehicles.summary';
const e2eApiRoutePattern = '**/api/**';

function expectNoPageErrors(pageErrors: string[]) {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
}

function expectNoUnhandledApiRequests(unhandledApiRequests: string[]) {
  expect(unhandledApiRequests, unhandledApiRequests.join('\n\n')).toEqual([]);
}

function buildE2EAccountingPeriod(input: {
  id: string;
  month: string;
  status: AccountingPeriodItem['status'];
  openedAt: string;
  lockedAt: string | null;
  hasOpeningBalanceSnapshot: boolean;
  openingBalanceSourceKind: AccountingPeriodItem['openingBalanceSourceKind'];
  statusHistory: AccountingPeriodItem['statusHistory'];
}): AccountingPeriodItem {
  const [yearToken, monthToken] = input.month.split('-');
  const year = Number(yearToken);
  const month = Number(monthToken);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    id: input.id,
    year,
    month,
    monthLabel: input.month,
    startDate: `${input.month}-01T00:00:00.000Z`,
    endDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`,
    status: input.status,
    openedAt: input.openedAt,
    lockedAt: input.lockedAt,
    hasOpeningBalanceSnapshot: input.hasOpeningBalanceSnapshot,
    openingBalanceSourceKind: input.openingBalanceSourceKind,
    statusHistory: input.statusHistory
  };
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

  await page.goto('/reference-data/manage');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/reference-data\/manage$/);
  await expect(
    page.getByRole('heading', { name: '기준 데이터 관리와 참조 입력' })
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

test('manages insurance policies through the insurance policies UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const newInsuranceProductName = `E2E 보험 계약 ${Date.now()}`;
  const renamedInsuranceProductName = `${newInsuranceProductName} 수정`;
  const currentUser = createE2ECurrentUser();
  let sessionActive = false;
  const fundingAccounts = createE2EFundingAccounts();
  const categories = createE2ECategories();
  let recurringRules = createE2ERecurringRules();
  let insurancePolicies = createE2EInsurancePolicies();

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

    if (path === '/api/insurance-policies' && request.method() === 'GET') {
      const includeInactive =
        url.searchParams.get('includeInactive') === 'true';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          includeInactive
            ? insurancePolicies
            : insurancePolicies.filter((policy) => policy.isActive)
        )
      });
      return;
    }

    if (path === '/api/insurance-policies' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateInsurancePolicyRequest;
      const seedToken = Date.now();
      const linkedRecurringRuleId = `rr-insurance-${seedToken}`;
      const created = buildInsurancePolicyItemFromPayload(payload, {
        id: `policy-e2e-${seedToken}`,
        fundingAccounts,
        categories,
        linkedRecurringRuleId
      });
      const syncedRecurringRule =
        buildInsuranceRecurringRuleItemFromPolicyPayload(payload, {
          id: linkedRecurringRuleId,
          insurancePolicyId: created.id,
          fundingAccounts,
          categories
        });

      recurringRules = mergeRecurringRulesForE2E(
        recurringRules,
        syncedRecurringRule
      );
      insurancePolicies = mergeInsurancePoliciesForE2E(
        insurancePolicies,
        created
      );

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (
      path.startsWith('/api/insurance-policies/') &&
      request.method() === 'PATCH'
    ) {
      const insurancePolicyId = path.split('/').at(-1) ?? '';
      const payload = request.postDataJSON() as UpdateInsurancePolicyRequest;
      const existingPolicy =
        insurancePolicies.find((policy) => policy.id === insurancePolicyId) ??
        null;
      const linkedRecurringRuleId =
        existingPolicy?.linkedRecurringRuleId ?? `rr-insurance-${Date.now()}`;
      const updated = buildInsurancePolicyItemFromPayload(payload, {
        id: insurancePolicyId,
        fundingAccounts,
        categories,
        linkedRecurringRuleId
      });
      const syncedRecurringRule =
        buildInsuranceRecurringRuleItemFromPolicyPayload(payload, {
          id: linkedRecurringRuleId,
          insurancePolicyId: updated.id,
          fundingAccounts,
          categories
        });

      recurringRules = mergeRecurringRulesForE2E(
        recurringRules,
        syncedRecurringRule
      );
      insurancePolicies = mergeInsurancePoliciesForE2E(
        insurancePolicies,
        updated
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (
      path.startsWith('/api/insurance-policies/') &&
      request.method() === 'DELETE'
    ) {
      const insurancePolicyId = path.split('/').at(-1) ?? '';
      const existingPolicy =
        insurancePolicies.find((policy) => policy.id === insurancePolicyId) ??
        null;

      insurancePolicies = insurancePolicies.filter(
        (policy) => policy.id !== insurancePolicyId
      );
      recurringRules = recurringRules.filter(
        (rule) => rule.linkedInsurancePolicyId !== insurancePolicyId
      );

      await route.fulfill({
        status: existingPolicy ? 204 : 404,
        contentType: 'application/json',
        body: existingPolicy
          ? ''
          : JSON.stringify({ message: 'Insurance policy not found' })
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

  await page.goto('/insurances');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/insurances$/);
  await expect(
    page.getByRole('heading', { name: '보험 계약', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '보험 계약 등록' })
  ).toBeVisible();

  await page.getByRole('button', { name: '보험 계약 등록' }).click();
  await expect(
    page.getByRole('heading', { name: '보험 계약 등록' })
  ).toBeVisible();
  const insurancePolicyForm = page.locator('form');
  await insurancePolicyForm
    .getByRole('textbox', { name: '보험사' })
    .fill('메리츠화재');
  await insurancePolicyForm
    .getByRole('textbox', { name: '상품명' })
    .fill(newInsuranceProductName);
  await insurancePolicyForm.getByLabel('월 보험료 (원)').fill('88000');
  await insurancePolicyForm.getByRole('combobox', { name: '자금수단' }).click();
  await page.getByRole('option', { name: '사업 운영 통장' }).click();
  await insurancePolicyForm
    .getByRole('combobox', { name: '지출 카테고리' })
    .click();
  await page.getByRole('option', { name: '보험료' }).click();
  await insurancePolicyForm.getByLabel('반복 시작일').fill('2026-04-25');
  await insurancePolicyForm.getByLabel('갱신일').fill('2026-10-15');
  await insurancePolicyForm
    .getByRole('button', { name: '보험 계약 저장' })
    .click();

  await expect(
    page.getByText(
      `${newInsuranceProductName} 보험 계약과 연결 규칙을 등록했습니다.`
    )
  ).toBeVisible();
  const newInsurancePolicyRow = page.getByRole('row', {
    name: new RegExp(newInsuranceProductName)
  });
  await expect(
    page.getByRole('gridcell', { name: newInsuranceProductName, exact: true })
  ).toBeVisible();
  await expect(
    newInsurancePolicyRow.getByText('연결됨', { exact: true })
  ).toBeVisible();

  await page.goto('/recurring');
  await expect(page).toHaveURL(/\/recurring$/);
  await expect(
    page.getByRole('gridcell', {
      name: `메리츠화재 ${newInsuranceProductName}`,
      exact: true
    })
  ).toBeVisible();

  await page.goto('/insurances');
  await expect(page).toHaveURL(/\/insurances$/);
  await page
    .getByRole('row', { name: new RegExp(newInsuranceProductName) })
    .getByRole('button', { name: '수정' })
    .click();
  await expect(
    page.getByRole('heading', { name: '보험 계약 수정' })
  ).toBeVisible();
  await insurancePolicyForm
    .getByRole('textbox', { name: '상품명' })
    .fill(renamedInsuranceProductName);
  await insurancePolicyForm.getByRole('combobox', { name: '상태' }).click();
  await page.getByRole('option', { name: '비활성' }).click();
  await insurancePolicyForm
    .getByRole('button', { name: '보험 계약 수정' })
    .click();

  await expect(
    page.getByText(
      `${renamedInsuranceProductName} 보험 계약과 연결 규칙을 수정했습니다.`
    )
  ).toBeVisible();
  const renamedInsurancePolicyRow = page.getByRole('row', {
    name: new RegExp(renamedInsuranceProductName)
  });
  await expect(
    renamedInsurancePolicyRow.getByText('비활성', { exact: true })
  ).toBeVisible();
  await expect(
    renamedInsurancePolicyRow.getByText('연결됨', { exact: true })
  ).toBeVisible();

  await page.goto('/recurring');
  await expect(page).toHaveURL(/\/recurring$/);
  const renamedRecurringRuleRow = page.getByRole('row', {
    name: new RegExp(renamedInsuranceProductName)
  });
  await expect(
    page.getByRole('gridcell', {
      name: `메리츠화재 ${renamedInsuranceProductName}`,
      exact: true
    })
  ).toBeVisible();
  await expect(
    renamedRecurringRuleRow.getByText('중지', { exact: true })
  ).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

test('manages vehicles through the vehicles UI', async ({ page }) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const newVehicleName = `E2E 차량 ${Date.now()}`;
  const renamedVehicleName = `${newVehicleName} 수정`;
  const newFuelAmountWon = 76_431;
  const updatedFuelAmountWon = 81_234;
  const newMaintenanceDescription = `엔진오일 교체 ${Date.now()}`;
  const renamedMaintenanceDescription = `${newMaintenanceDescription} 완료`;
  const currentUser = createE2ECurrentUser();
  let sessionActive = false;
  let vehicles = createE2EVehicles();
  let fuelLogs = createE2EVehicleFuelLogs();
  let maintenanceLogs = createE2EVehicleMaintenanceLogs();

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

    if (path === '/api/vehicles' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(vehicles)
      });
      return;
    }

    if (
      path === '/api/vehicles/operating-summary' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildVehicleOperatingSummaryView({
            vehicles,
            fuelLogs,
            maintenanceLogs
          })
        )
      });
      return;
    }

    if (path === '/api/vehicles' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateVehicleRequest;
      const created = buildVehicleItemFromPayload(payload, {
        id: `vehicle-e2e-${Date.now()}`
      });

      vehicles = mergeVehiclesForE2E(vehicles, created);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (path === '/api/vehicles/fuel-logs' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fuelLogs)
      });
      return;
    }

    if (
      /^\/api\/vehicles\/[^/]+\/fuel-logs$/.test(path) &&
      request.method() === 'POST'
    ) {
      const pathSegments = path.split('/').filter(Boolean);
      const vehicleId = pathSegments[2] ?? '';
      const payload = request.postDataJSON() as CreateVehicleFuelLogRequest;
      const vehicle =
        vehicles.find((candidate) => candidate.id === vehicleId) ?? null;
      const created = buildVehicleFuelLogItemFromPayload(payload, {
        id: `fuel-e2e-${Date.now()}`,
        vehicleId,
        vehicleName: vehicle?.name ?? '알 수 없는 차량'
      });

      fuelLogs = mergeVehicleFuelLogsForE2E(fuelLogs, created);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (
      /^\/api\/vehicles\/[^/]+\/fuel-logs\/[^/]+$/.test(path) &&
      request.method() === 'PATCH'
    ) {
      const pathSegments = path.split('/').filter(Boolean);
      const vehicleId = pathSegments[2] ?? '';
      const fuelLogId = pathSegments[4] ?? '';
      const payload = request.postDataJSON() as UpdateVehicleFuelLogRequest;
      const currentFuelLog =
        fuelLogs.find((fuelLog) => fuelLog.id === fuelLogId) ?? null;
      const updated = buildVehicleFuelLogItemFromPayload(payload, {
        id: fuelLogId,
        vehicleId,
        vehicleName: currentFuelLog?.vehicleName ?? '알 수 없는 차량'
      });

      fuelLogs = mergeVehicleFuelLogsForE2E(fuelLogs, updated);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (
      path === '/api/vehicles/maintenance-logs' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(maintenanceLogs)
      });
      return;
    }

    if (
      /^\/api\/vehicles\/[^/]+\/maintenance-logs$/.test(path) &&
      request.method() === 'POST'
    ) {
      const pathSegments = path.split('/').filter(Boolean);
      const vehicleId = pathSegments[2] ?? '';
      const payload =
        request.postDataJSON() as CreateVehicleMaintenanceLogRequest;
      const vehicle =
        vehicles.find((candidate) => candidate.id === vehicleId) ?? null;
      const created = buildVehicleMaintenanceLogItemFromPayload(payload, {
        id: `maintenance-e2e-${Date.now()}`,
        vehicleId,
        vehicleName: vehicle?.name ?? '알 수 없는 차량'
      });

      maintenanceLogs = mergeVehicleMaintenanceLogsForE2E(
        maintenanceLogs,
        created
      );

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (
      /^\/api\/vehicles\/[^/]+\/maintenance-logs\/[^/]+$/.test(path) &&
      request.method() === 'PATCH'
    ) {
      const pathSegments = path.split('/').filter(Boolean);
      const vehicleId = pathSegments[2] ?? '';
      const maintenanceLogId = pathSegments[4] ?? '';
      const payload =
        request.postDataJSON() as UpdateVehicleMaintenanceLogRequest;
      const currentMaintenanceLog =
        maintenanceLogs.find(
          (maintenanceLog) => maintenanceLog.id === maintenanceLogId
        ) ?? null;
      const updated = buildVehicleMaintenanceLogItemFromPayload(payload, {
        id: maintenanceLogId,
        vehicleId,
        vehicleName: currentMaintenanceLog?.vehicleName ?? '알 수 없는 차량'
      });

      maintenanceLogs = mergeVehicleMaintenanceLogsForE2E(
        maintenanceLogs,
        updated
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (/^\/api\/vehicles\/[^/]+$/.test(path) && request.method() === 'PATCH') {
      const vehicleId = path.split('/').at(-1) ?? '';
      const payload = request.postDataJSON() as UpdateVehicleRequest;
      const updated = buildVehicleItemFromPayload(payload, {
        id: vehicleId
      });

      vehicles = mergeVehiclesForE2E(vehicles, updated);
      fuelLogs = fuelLogs.map((fuelLog) =>
        fuelLog.vehicleId === vehicleId
          ? {
              ...fuelLog,
              vehicleName: updated.name
            }
          : fuelLog
      );
      maintenanceLogs = maintenanceLogs.map((maintenanceLog) =>
        maintenanceLog.vehicleId === vehicleId
          ? {
              ...maintenanceLog,
              vehicleName: updated.name
            }
          : maintenanceLog
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
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

  await page.goto('/vehicles');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/vehicles$/);
  await expect(
    page.getByRole('heading', { name: '차량 운영', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '차량 등록' })).toBeVisible();
  const vehicleTableCard = page
    .getByRole('heading', { name: '차량 기본 정보', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]');
  const fuelTableCard = page
    .getByRole('heading', { name: '주유 / 충전 기록', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]');
  const maintenanceTableCard = page
    .getByRole('heading', { name: '정비 이력', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]');

  await page.getByRole('button', { name: '차량 등록' }).click();
  await expect(page.getByRole('heading', { name: '차량 등록' })).toBeVisible();
  const vehicleForm = page.locator('form');
  await vehicleForm
    .getByRole('textbox', { name: '차량명' })
    .fill(newVehicleName);
  await vehicleForm.getByRole('textbox', { name: '제조사' }).fill('Kia');
  await vehicleForm.getByLabel('초기 주행거리 (km)').fill('12400');
  await vehicleForm.getByLabel('예상 연비 (km/L)').fill('14.8');
  await vehicleForm.getByRole('button', { name: '차량 저장' }).click();

  await expect(
    page.getByText(`${newVehicleName} 차량을 등록했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: newVehicleName, exact: true })
  ).toBeVisible();

  const newVehicleRow = vehicleTableCard.getByRole('row', {
    name: new RegExp(newVehicleName)
  });
  await newVehicleRow.getByRole('button', { name: '수정' }).click();
  await expect(page.getByRole('heading', { name: '차량 수정' })).toBeVisible();
  await vehicleForm
    .getByRole('textbox', { name: '차량명' })
    .fill(renamedVehicleName);
  await vehicleForm.getByRole('button', { name: '차량 수정' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 차량 정보를 수정했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: renamedVehicleName, exact: true })
  ).toBeVisible();

  const renamedVehicleRow = vehicleTableCard.getByRole('row', {
    name: new RegExp(renamedVehicleName)
  });
  await renamedVehicleRow.getByRole('button', { name: '연료 기록' }).click();
  await expect(
    page.getByRole('heading', { name: '연료 기록 추가' })
  ).toBeVisible();
  const fuelForm = page.locator('form').last();
  await fuelForm.getByLabel('주유일').fill('2026-03-27');
  await fuelForm.getByLabel('주유 시점 주행거리 (km)').fill('58910');
  await fuelForm.getByLabel('주유량 (L)').fill('44.2');
  await fuelForm.getByLabel('주유 금액 (원)').fill(String(newFuelAmountWon));
  await fuelForm.getByLabel('리터당 단가 (원)').fill('1729');
  await fuelForm.getByRole('button', { name: '연료 기록 저장' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 연료 기록을 추가했습니다.`)
  ).toBeVisible();
  const createdFuelRow = fuelTableCard.getByRole('row', {
    name: new RegExp(`${renamedVehicleName}.*76,431`)
  });
  await expect(createdFuelRow).toBeVisible();
  await expect(
    createdFuelRow.getByRole('gridcell', {
      name: '₩76,431',
      exact: true
    })
  ).toBeVisible();

  await createdFuelRow.getByRole('button', { name: '수정' }).click();
  await expect(
    page.getByRole('heading', { name: '연료 기록 수정' })
  ).toBeVisible();
  const fuelEditForm = page.locator('form').last();
  await fuelEditForm.getByLabel('주유일').fill('2026-03-28');
  await fuelEditForm
    .getByLabel('주유 금액 (원)')
    .fill(String(updatedFuelAmountWon));
  await fuelEditForm
    .getByRole('checkbox', { name: '가득 주유 / 완충 기록' })
    .uncheck();
  await fuelEditForm.getByRole('button', { name: '연료 기록 수정' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 연료 기록을 수정했습니다.`)
  ).toBeVisible();
  const updatedFuelRow = fuelTableCard.getByRole('row', {
    name: new RegExp(`${renamedVehicleName}.*81,234`)
  });
  await expect(updatedFuelRow).toBeVisible();
  await expect(
    updatedFuelRow.getByRole('gridcell', {
      name: '₩81,234',
      exact: true
    })
  ).toBeVisible();

  await renamedVehicleRow.getByRole('button', { name: '정비 기록' }).click();
  await expect(
    page.getByRole('heading', { name: '정비 기록 추가' })
  ).toBeVisible();
  const maintenanceForm = page.locator('form').last();
  await maintenanceForm.getByLabel('정비일').fill('2026-03-26');
  await maintenanceForm.getByLabel('정비 시점 주행거리 (km)').fill('58940');
  await maintenanceForm.getByLabel('정비 비용 (원)').fill('198000');
  await maintenanceForm
    .getByRole('textbox', { name: '정비처' })
    .fill('현대 블루핸즈');
  await maintenanceForm
    .getByRole('textbox', { name: '정비 내용' })
    .fill(newMaintenanceDescription);
  await maintenanceForm
    .getByRole('textbox', { name: '메모' })
    .fill('엔진오일과 필터를 함께 교체했습니다.');
  await maintenanceForm.getByRole('button', { name: '정비 저장' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 정비 기록을 추가했습니다.`)
  ).toBeVisible();
  const createdMaintenanceRow = maintenanceTableCard.getByRole('row', {
    name: new RegExp(newMaintenanceDescription)
  });
  await expect(createdMaintenanceRow).toBeVisible();
  await expect(
    createdMaintenanceRow.getByRole('gridcell', {
      name: '₩198,000',
      exact: true
    })
  ).toBeVisible();

  await createdMaintenanceRow.getByRole('button', { name: '수정' }).click();
  await expect(
    page.getByRole('heading', { name: '정비 기록 수정' })
  ).toBeVisible();
  const maintenanceEditForm = page.locator('form').last();
  await maintenanceEditForm
    .getByRole('textbox', { name: '정비 내용' })
    .fill(renamedMaintenanceDescription);
  await maintenanceEditForm.getByLabel('정비 비용 (원)').fill('212000');
  await maintenanceEditForm.getByRole('button', { name: '정비 수정' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 정비 기록을 수정했습니다.`)
  ).toBeVisible();
  const renamedMaintenanceRow = maintenanceTableCard.getByRole('row', {
    name: new RegExp(renamedMaintenanceDescription)
  });
  await expect(renamedMaintenanceRow).toBeVisible();
  await expect(
    renamedMaintenanceRow.getByRole('gridcell', {
      name: '₩212,000',
      exact: true
    })
  ).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

test('@smoke manages the accounting period lifecycle through open, close, and reopen flows', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const currentUser = createE2ECurrentUser();
  const fundingAccounts = createE2EFundingAccounts();
  const categories = createE2ECategories();
  const accountSubjects = createE2EAccountSubjects();
  const readiness = buildReferenceDataReadinessSummary({
    fundingAccounts,
    categories
  });
  let sessionActive = false;
  let periods: AccountingPeriodItem[] = [];

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
        body: JSON.stringify(readiness)
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

    if (path === '/api/funding-accounts' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fundingAccounts)
      });
      return;
    }

    if (path === '/api/accounting-periods' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(periods)
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
        body: JSON.stringify(
          periods.find((period) => period.status !== 'LOCKED') ??
            periods[0] ??
            null
        )
      });
      return;
    }

    if (path === '/api/accounting-periods' && request.method() === 'POST') {
      const payload = request.postDataJSON() as OpenAccountingPeriodRequest;
      const openedAt = `${payload.month}-01T00:00:00.000Z`;
      const createdPeriod = buildE2EAccountingPeriod({
        id: `period-${payload.month}`,
        month: payload.month,
        status: 'OPEN',
        openedAt,
        lockedAt: null,
        hasOpeningBalanceSnapshot: Boolean(
          payload.initializeOpeningBalance ||
          payload.openingBalanceLines?.length
        ),
        openingBalanceSourceKind:
          payload.initializeOpeningBalance ||
          payload.openingBalanceLines?.length
            ? 'INITIAL_SETUP'
            : null,
        statusHistory: [
          {
            id: `period-${payload.month}-opened`,
            fromStatus: null,
            toStatus: 'OPEN',
            eventType: 'OPEN',
            reason: payload.note?.trim() || null,
            actorType: 'TENANT_MEMBERSHIP',
            actorMembershipId: 'membership-demo',
            changedAt: openedAt
          }
        ]
      });

      periods = [createdPeriod];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdPeriod)
      });
      return;
    }

    if (
      /^\/api\/accounting-periods\/[^/]+\/close$/.test(path) &&
      request.method() === 'POST'
    ) {
      const periodId = path.split('/')[3] ?? '';
      const payload = request.postDataJSON() as CloseAccountingPeriodRequest;
      const currentPeriod =
        periods.find((period) => period.id === periodId) ?? null;

      if (!currentPeriod) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '운영 기간을 찾지 못했습니다.'
          })
        });
        return;
      }

      const lockedAt = `${currentPeriod.monthLabel}-28T15:00:00.000Z`;
      const closedPeriod: AccountingPeriodItem = {
        ...currentPeriod,
        status: 'LOCKED',
        lockedAt,
        statusHistory: [
          {
            id: `${currentPeriod.id}-locked`,
            fromStatus: currentPeriod.status,
            toStatus: 'LOCKED',
            eventType: 'LOCK',
            reason: payload.note?.trim() || null,
            actorType: 'TENANT_MEMBERSHIP',
            actorMembershipId: 'membership-demo',
            changedAt: lockedAt
          },
          ...currentPeriod.statusHistory
        ]
      };
      const closingResult: CloseAccountingPeriodResponse = {
        period: closedPeriod,
        closingSnapshot: {
          id: `closing-snapshot-${currentPeriod.id}`,
          periodId: currentPeriod.id,
          lockedAt,
          totalAssetAmount: 1_200_000,
          totalLiabilityAmount: 0,
          totalEquityAmount: 0,
          periodPnLAmount: 0,
          lines: [
            {
              id: `closing-line-${currentPeriod.id}-1`,
              accountSubjectCode: '1010',
              accountSubjectName: '현금및예금',
              fundingAccountName: '사업 운영 통장',
              balanceAmount: 1_200_000
            }
          ]
        }
      };

      periods = [closedPeriod];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(closingResult)
      });
      return;
    }

    if (
      /^\/api\/accounting-periods\/[^/]+\/reopen$/.test(path) &&
      request.method() === 'POST'
    ) {
      const periodId = path.split('/')[3] ?? '';
      const payload = request.postDataJSON() as ReopenAccountingPeriodRequest;
      const currentPeriod =
        periods.find((period) => period.id === periodId) ?? null;

      if (!currentPeriod) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '운영 기간을 찾지 못했습니다.'
          })
        });
        return;
      }

      const reopenedAt = `${currentPeriod.monthLabel}-29T01:00:00.000Z`;
      const reopenedPeriod: AccountingPeriodItem = {
        ...currentPeriod,
        status: 'OPEN',
        lockedAt: null,
        statusHistory: [
          {
            id: `${currentPeriod.id}-reopened`,
            fromStatus: currentPeriod.status,
            toStatus: 'OPEN',
            eventType: 'REOPEN',
            reason: payload.reason.trim(),
            actorType: 'TENANT_MEMBERSHIP',
            actorMembershipId: 'membership-demo',
            changedAt: reopenedAt
          },
          ...currentPeriod.statusHistory
        ]
      };

      periods = [reopenedPeriod];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reopenedPeriod)
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

  await page.goto('/periods');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/periods$/);
  await expect(
    page.getByRole('heading', { name: '운영 기간 관리' })
  ).toBeVisible();

  const openForm = page.locator('#open-accounting-period-form');
  await openForm.getByLabel('운영 월').fill('2026-05');
  await openForm.getByRole('button', { name: '라인 추가' }).click();
  await openForm.getByLabel('계정과목').click();
  await page.getByRole('option', { name: '1010 현금및예금' }).click();
  await openForm.getByLabel('자금수단').click();
  await page.getByRole('option', { name: '사업 운영 통장' }).click();
  await openForm.getByLabel('잔액(원)').fill('1200000');
  await openForm.getByLabel('메모').fill('E2E 첫 월 운영 시작');
  await openForm.getByRole('button', { name: '월 운영 시작' }).click();

  await expect(
    page.getByText('2026-05 운영 기간을 시작했습니다.')
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: '초기 설정' }).first()
  ).toBeVisible();

  await page.getByRole('tab', { name: '월 마감' }).click();
  await page.getByLabel('마감 메모').fill('E2E 월 마감');
  await page.getByRole('button', { name: '월 마감', exact: true }).click();

  await expect(page.getByText('2026-05 월 마감을 완료했습니다.')).toBeVisible();
  await expect(
    page.getByText('2026-05 월 마감이 완료되었습니다.')
  ).toBeVisible();
  await expect(page.getByText('LOCKED').first()).toBeVisible();

  await page.getByRole('tab', { name: '월 재오픈' }).click();
  await page.getByLabel('재오픈 사유').fill('E2E 정정 준비');
  await page.getByRole('button', { name: '월 재오픈', exact: true }).click();

  await expect(page.getByText('2026-05 월을 재오픈했습니다.')).toBeVisible();
  await expect(page.getByText('E2E 정정 준비')).toBeVisible();
  await expect(page.getByText('OPEN').first()).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

test('@smoke manages journal entry reversal and correction through the journal entries UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const currentUser = createE2ECurrentUser();
  const fundingAccounts = createE2EFundingAccounts();
  const accountSubjects: AccountSubjectItem[] = [
    ...createE2EAccountSubjects(),
    {
      id: 'as-5100',
      code: '5100',
      name: '차량유지비',
      statementType: 'PROFIT_AND_LOSS',
      normalSide: 'DEBIT',
      subjectKind: 'EXPENSE',
      isSystem: true,
      isActive: true
    }
  ];
  const currentPeriod = buildE2EAccountingPeriod({
    id: 'period-2026-05',
    month: '2026-05',
    status: 'OPEN',
    openedAt: '2026-05-01T00:00:00.000Z',
    lockedAt: null,
    hasOpeningBalanceSnapshot: true,
    openingBalanceSourceKind: 'CARRY_FORWARD',
    statusHistory: [
      {
        id: 'period-2026-05-opened',
        fromStatus: null,
        toStatus: 'OPEN',
        eventType: 'OPEN',
        reason: 'Playwright journal entry scenario setup',
        actorType: 'TENANT_MEMBERSHIP',
        actorMembershipId: 'membership-demo',
        changedAt: '2026-05-01T00:00:00.000Z'
      }
    ]
  });
  let sessionActive = false;
  let journalEntries: JournalEntryItem[] = [
    {
      id: 'je-income-1',
      entryNumber: '202605-0001',
      entryDate: '2026-05-03T00:00:00.000Z',
      status: 'POSTED',
      sourceKind: 'COLLECTED_TRANSACTION',
      memo: '5월 스마트스토어 매출',
      sourceCollectedTransactionId: 'txn-income-1',
      sourceCollectedTransactionTitle: '5월 스마트스토어 매출',
      reversesJournalEntryId: null,
      reversesJournalEntryNumber: null,
      reversedByJournalEntryId: null,
      reversedByJournalEntryNumber: null,
      correctsJournalEntryId: null,
      correctsJournalEntryNumber: null,
      correctionEntryIds: [],
      correctionEntryNumbers: [],
      correctionReason: null,
      createdByActorType: 'TENANT_MEMBERSHIP',
      createdByMembershipId: 'membership-demo',
      lines: [
        {
          id: 'je-income-1-line-1',
          lineNumber: 1,
          accountSubjectCode: '1010',
          accountSubjectName: '현금및예금',
          fundingAccountName: '사업 운영 통장',
          debitAmount: 3_200_000,
          creditAmount: 0,
          description: '5월 스마트스토어 매출'
        },
        {
          id: 'je-income-1-line-2',
          lineNumber: 2,
          accountSubjectCode: '4100',
          accountSubjectName: '운영수익',
          fundingAccountName: null,
          debitAmount: 0,
          creditAmount: 3_200_000,
          description: '5월 스마트스토어 매출'
        }
      ]
    },
    {
      id: 'je-expense-1',
      entryNumber: '202605-0002',
      entryDate: '2026-05-04T00:00:00.000Z',
      status: 'POSTED',
      sourceKind: 'COLLECTED_TRANSACTION',
      memo: '배송 차량 주유',
      sourceCollectedTransactionId: 'txn-expense-1',
      sourceCollectedTransactionTitle: '배송 차량 주유',
      reversesJournalEntryId: null,
      reversesJournalEntryNumber: null,
      reversedByJournalEntryId: null,
      reversedByJournalEntryNumber: null,
      correctsJournalEntryId: null,
      correctsJournalEntryNumber: null,
      correctionEntryIds: [],
      correctionEntryNumbers: [],
      correctionReason: null,
      createdByActorType: 'TENANT_MEMBERSHIP',
      createdByMembershipId: 'membership-demo',
      lines: [
        {
          id: 'je-expense-1-line-1',
          lineNumber: 1,
          accountSubjectCode: '5100',
          accountSubjectName: '차량유지비',
          fundingAccountName: null,
          debitAmount: 84_000,
          creditAmount: 0,
          description: '배송 차량 주유'
        },
        {
          id: 'je-expense-1-line-2',
          lineNumber: 2,
          accountSubjectCode: '1010',
          accountSubjectName: '현금및예금',
          fundingAccountName: '비용 예비 통장',
          debitAmount: 0,
          creditAmount: 84_000,
          description: '배송 차량 주유'
        }
      ]
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
        body: JSON.stringify(journalEntries)
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

    if (path === '/api/funding-accounts' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fundingAccounts)
      });
      return;
    }

    if (
      /^\/api\/journal-entries\/[^/]+\/reverse$/.test(path) &&
      request.method() === 'POST'
    ) {
      const journalEntryId = path.split('/')[3] ?? '';
      const payload = request.postDataJSON() as ReverseJournalEntryRequest;
      const targetEntry =
        journalEntries.find((entry) => entry.id === journalEntryId) ?? null;

      if (!targetEntry) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '전표를 찾지 못했습니다.'
          })
        });
        return;
      }

      const createdEntry: JournalEntryItem = {
        id: 'je-reverse-1',
        entryNumber: '202605-0003',
        entryDate: `${payload.entryDate}T00:00:00.000Z`,
        status: 'POSTED',
        sourceKind: 'MANUAL_ADJUSTMENT',
        memo:
          payload.reason?.trim() || `Reversal of ${targetEntry.entryNumber}`,
        sourceCollectedTransactionId: null,
        sourceCollectedTransactionTitle: null,
        reversesJournalEntryId: targetEntry.id,
        reversesJournalEntryNumber: targetEntry.entryNumber,
        reversedByJournalEntryId: null,
        reversedByJournalEntryNumber: null,
        correctsJournalEntryId: null,
        correctsJournalEntryNumber: null,
        correctionEntryIds: [],
        correctionEntryNumbers: [],
        correctionReason: null,
        createdByActorType: 'TENANT_MEMBERSHIP',
        createdByMembershipId: 'membership-demo',
        lines: targetEntry.lines.map((line, index) => ({
          id: `je-reverse-1-line-${index + 1}`,
          lineNumber: index + 1,
          accountSubjectCode: line.accountSubjectCode,
          accountSubjectName: line.accountSubjectName,
          fundingAccountName: line.fundingAccountName,
          debitAmount: line.creditAmount,
          creditAmount: line.debitAmount,
          description: line.description
        }))
      };
      const updatedTarget: JournalEntryItem = {
        ...targetEntry,
        status: 'REVERSED',
        reversedByJournalEntryId: createdEntry.id,
        reversedByJournalEntryNumber: createdEntry.entryNumber
      };

      journalEntries = [
        createdEntry,
        updatedTarget,
        ...journalEntries.filter((entry) => entry.id !== targetEntry.id)
      ];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdEntry)
      });
      return;
    }

    if (
      /^\/api\/journal-entries\/[^/]+\/correct$/.test(path) &&
      request.method() === 'POST'
    ) {
      const journalEntryId = path.split('/')[3] ?? '';
      const payload = request.postDataJSON() as CorrectJournalEntryRequest;
      const targetEntry =
        journalEntries.find((entry) => entry.id === journalEntryId) ?? null;

      if (!targetEntry) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '전표를 찾지 못했습니다.'
          })
        });
        return;
      }

      const createdEntry: JournalEntryItem = {
        id: 'je-correct-1',
        entryNumber: '202605-0004',
        entryDate: `${payload.entryDate}T00:00:00.000Z`,
        status: 'POSTED',
        sourceKind: 'MANUAL_ADJUSTMENT',
        memo: payload.reason,
        sourceCollectedTransactionId: null,
        sourceCollectedTransactionTitle: null,
        reversesJournalEntryId: null,
        reversesJournalEntryNumber: null,
        reversedByJournalEntryId: null,
        reversedByJournalEntryNumber: null,
        correctsJournalEntryId: targetEntry.id,
        correctsJournalEntryNumber: targetEntry.entryNumber,
        correctionEntryIds: [],
        correctionEntryNumbers: [],
        correctionReason: payload.reason,
        createdByActorType: 'TENANT_MEMBERSHIP',
        createdByMembershipId: 'membership-demo',
        lines: payload.lines.map((line, index) => {
          const accountSubject =
            accountSubjects.find(
              (candidate) => candidate.id === line.accountSubjectId
            ) ?? null;
          const fundingAccount =
            line.fundingAccountId == null
              ? null
              : (fundingAccounts.find(
                  (candidate) => candidate.id === line.fundingAccountId
                ) ?? null);

          return {
            id: `je-correct-1-line-${index + 1}`,
            lineNumber: index + 1,
            accountSubjectCode: accountSubject?.code ?? '',
            accountSubjectName: accountSubject?.name ?? '',
            fundingAccountName: fundingAccount?.name ?? null,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description?.trim() || null
          };
        })
      };
      const updatedTarget: JournalEntryItem = {
        ...targetEntry,
        status: 'SUPERSEDED',
        correctionEntryIds: [
          ...(targetEntry.correctionEntryIds ?? []),
          createdEntry.id
        ],
        correctionEntryNumbers: [
          ...(targetEntry.correctionEntryNumbers ?? []),
          createdEntry.entryNumber
        ]
      };

      journalEntries = [
        createdEntry,
        updatedTarget,
        ...journalEntries.filter((entry) => entry.id !== targetEntry.id)
      ];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdEntry)
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

  await page.goto('/journal-entries');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/journal-entries$/);
  await expect(page.getByRole('heading', { name: '전표 조회' })).toBeVisible();
  await expect(
    page.getByText(
      '현재 열린 운영 기간은 2026-05이며, 반전/정정 전표는 이 기간 안의 일자로만 생성할 수 있습니다.'
    )
  ).toBeVisible();

  const incomeEntryCard = page
    .getByRole('heading', { name: '202605-0001 전표' })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]');
  await incomeEntryCard.getByRole('button', { name: '반전 전표' }).click();

  const reverseDialog = page.getByRole('dialog');
  await expect(
    reverseDialog.getByRole('heading', { name: '202605-0001 반전 전표 생성' })
  ).toBeVisible();
  await reverseDialog.getByLabel('반전 전표 일자').fill('2026-05-05');
  await reverseDialog.getByLabel('반전 사유').fill('이중 확정 취소');
  await reverseDialog.getByRole('button', { name: '반전 전표 생성' }).click();

  await expect(
    page.getByText('202605-0003 반전 전표를 생성했습니다.')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/journal-entries\?entryId=je-reverse-1$/);
  await expect(page.getByText(/반전 원본:\s*202605-0001/)).toBeVisible();
  await expect(page.getByText(/후속 반전 전표:\s*202605-0003/)).toBeVisible();

  const expenseEntryCard = page
    .getByRole('heading', { name: '202605-0002 전표' })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]');
  await expenseEntryCard.getByRole('button', { name: '정정 전표' }).click();

  const correctDialog = page.getByRole('dialog');
  await expect(
    correctDialog.getByRole('heading', { name: '202605-0002 정정 전표 생성' })
  ).toBeVisible();
  await correctDialog.getByLabel('정정 전표 일자').fill('2026-05-06');
  await correctDialog.getByLabel('정정 사유').fill('영수증 재확인');
  await correctDialog.getByLabel('차변').nth(0).fill('95000');
  await correctDialog.getByLabel('대변').nth(1).fill('95000');
  await correctDialog.getByRole('button', { name: '정정 전표 생성' }).click();

  await expect(
    page.getByText('202605-0004 정정 전표를 생성했습니다.')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/journal-entries\?entryId=je-correct-1$/);
  await expect(page.getByText(/정정 원본:\s*202605-0002/)).toBeVisible();
  await expect(page.getByText(/정정 사유:\s*영수증 재확인/)).toBeVisible();
  await expect(page.getByText(/후속 정정 전표:\s*202605-0004/)).toBeVisible();

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
    page.getByRole('heading', { name: '기준 데이터 준비 상태와 관리 범위' })
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
