import { expect, test } from '@playwright/test';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CategoryItem,
  CollectedTransactionItem,
  CreateCollectedTransactionRequest,
  FundingAccountItem
} from '@personal-erp/contracts';

test('protects the transactions route, restores the session, and saves a transaction through the UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
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
      balanceWon: 2_450_000
    },
    {
      id: 'acc-reserve',
      name: '비용 예비 통장',
      type: 'BANK',
      balanceWon: 430_000
    }
  ];

  const categories: CategoryItem[] = [
    {
      id: 'cat-materials',
      name: '원재료비',
      kind: 'EXPENSE'
    },
    {
      id: 'cat-sales',
      name: '매출 입금',
      kind: 'INCOME'
    }
  ];

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
      postedJournalEntryNumber: '202603-0001'
    }
  ];

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text());
    }
  });

  await page.route('http://localhost:4000/api/**', async (route) => {
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
        postingStatus: 'PENDING',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null
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

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        message: `Unhandled E2E route: ${request.method()} ${path}`
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

  await page.reload();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole('heading', { level: 4, name: '수집 거래', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Demo User')).toBeVisible();

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
    page.getByText(`${transactionTitle} 수집 거래를 등록했습니다.`)
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
});
