import { expect, test } from '@playwright/test';
import type {
  CategoryItem,
  CreateCategoryRequest,
  CreateFundingAccountRequest,
  FundingAccountItem,
  UpdateCategoryRequest,
  UpdateFundingAccountRequest
} from '@personal-erp/contracts';
import {
  buildReferenceDataReadinessSummary,
  createE2EAccountSubjects,
  createE2ECategories,
  createE2ECurrentUser,
  createE2EFundingAccounts,
  createE2ELedgerTransactionTypes
} from '../support/auth-transactions-fixtures';
import {
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';

test('manages funding accounts and categories across split reference data screens', async ({
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

  await page.goto('/reference-data/funding-accounts');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/reference-data\/funding-accounts$/);
  await expect(
    page.getByRole('heading', { level: 4, name: '자금수단' })
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

  await page.goto('/reference-data/categories');
  await expect(page).toHaveURL(/\/reference-data\/categories$/);
  await expect(
    page.getByRole('heading', { level: 4, name: '카테고리' })
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
