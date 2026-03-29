import { expect, test } from '@playwright/test';
import type {
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
        name: '개인 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE'
      }
    }
  };

  const fundingAccounts: FundingAccountItem[] = [
    {
      id: 'acc-main',
      name: 'Main Checking',
      type: 'BANK',
      balanceWon: 2_450_000
    },
    {
      id: 'acc-living',
      name: 'Living Expenses',
      type: 'BANK',
      balanceWon: 430_000
    }
  ];

  const categories: CategoryItem[] = [
    {
      id: 'cat-food',
      name: '식비',
      kind: 'EXPENSE'
    },
    {
      id: 'cat-salary',
      name: '급여',
      kind: 'INCOME'
    }
  ];

  let transactions: CollectedTransactionItem[] = [
    {
      id: 'txn-seeded-1',
      businessDate: '2026-03-12',
      title: '초기 지출',
      type: 'EXPENSE',
      amountWon: 126_000,
      fundingAccountName: '생활비 통장',
      categoryName: '식비',
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
        postingStatus: 'POSTED',
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
  await expect(page.getByRole('heading', { name: '수집 거래' })).toBeVisible();
  await expect(page.getByText('Demo User')).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole('heading', { name: '수집 거래' })).toBeVisible();
  await expect(page.getByText('Demo User')).toBeVisible();

  await page.getByRole('textbox', { name: '적요' }).fill(transactionTitle);
  await page.getByRole('spinbutton', { name: '금액 (원)' }).fill('54321');
  await page.getByLabel('거래일').fill(businessDate);

  const saveButton = page.getByRole('button', { name: '수집 거래 등록' });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(
    page.getByText('수집 거래를 등록했고 목록을 새로고침했습니다.')
  ).toBeVisible();
  await expect(page.getByText(transactionTitle)).toBeVisible();
});
