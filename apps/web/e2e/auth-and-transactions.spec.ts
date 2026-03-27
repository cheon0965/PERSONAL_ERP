import { expect, test } from '@playwright/test';
import type {
  AccountItem,
  AuthenticatedUser,
  CategoryItem,
  CreateTransactionRequest,
  TransactionItem
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
    name: 'Demo User'
  };

  const accounts: AccountItem[] = [
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
      name: 'Food',
      kind: 'EXPENSE'
    },
    {
      id: 'cat-salary',
      name: 'Salary',
      kind: 'INCOME'
    }
  ];

  let transactions: TransactionItem[] = [
    {
      id: 'txn-seeded-1',
      businessDate: '2026-03-12',
      title: 'Seeded expense',
      type: 'EXPENSE',
      amountWon: 126_000,
      accountName: 'Living Expenses',
      categoryName: 'Food',
      origin: 'MANUAL',
      status: 'POSTED'
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

    if (path === '/api/accounts' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accounts)
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

    if (path === '/api/transactions' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(transactions)
      });
      return;
    }

    if (path === '/api/transactions' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateTransactionRequest;
      const accountName =
        accounts.find((account) => account.id === payload.accountId)?.name ??
        '-';
      const categoryName =
        categories.find((category) => category.id === payload.categoryId)
          ?.name ?? '-';

      const createdItem: TransactionItem = {
        id: `txn-e2e-${Date.now()}`,
        businessDate: payload.businessDate,
        title: payload.title,
        type: payload.type,
        amountWon: payload.amountWon,
        accountName,
        categoryName,
        origin: 'MANUAL',
        status: 'POSTED'
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
    page.getByRole('heading', { name: 'Sign in to the workspace' })
  ).toBeVisible();

  await page.getByLabel('Email').fill('demo@example.com');
  await page.getByLabel('Password').fill('Demo1234!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole('heading', { name: 'Transactions' })
  ).toBeVisible();
  await expect(page.getByText('Demo User')).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole('heading', { name: 'Transactions' })
  ).toBeVisible();
  await expect(page.getByText('Demo User')).toBeVisible();

  await page.getByRole('textbox', { name: 'Title' }).fill(transactionTitle);
  await page.getByRole('spinbutton', { name: 'Amount (KRW)' }).fill('54321');
  await page.getByLabel('Business Date').fill(businessDate);

  const saveButton = page.getByRole('button', { name: 'Save Transaction' });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(
    page.getByText('Transaction saved and the ledger list was refreshed.')
  ).toBeVisible();
  await expect(page.getByText(transactionTitle)).toBeVisible();
});
