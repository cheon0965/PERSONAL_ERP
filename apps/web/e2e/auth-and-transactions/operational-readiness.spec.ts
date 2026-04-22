import { expect, test } from '@playwright/test';
import type { CategoryItem, FundingAccountItem } from '@personal-erp/contracts';
import {
  buildReferenceDataReadinessSummary,
  createE2EAccountSubjects,
  createE2ECurrentUser,
  createE2ELedgerTransactionTypes
} from '../support/auth-transactions-fixtures';
import {
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';

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
  await expect(
    page.getByRole('heading', { name: '운영 포털 로그인' })
  ).toBeVisible();

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: '월 운영 대시보드' })
  ).toBeVisible();
  await expect(page.getByText('운영 기간이 아직 없습니다')).toBeVisible();
  await page
    .getByRole('heading', { name: '운영 기간이 아직 없습니다' })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]')
    .getByRole('link', { name: '운영 월 보기' })
    .click();
  await expect(page).toHaveURL(/\/periods$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '운영 기간', exact: true })
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
      '먼저 월 운영 화면에서 운영 월을 시작하면 수집 거래 입력과 전표 확정 흐름이 열립니다.'
    )
  ).toBeVisible();
  await page.getByRole('link', { name: '기준 데이터 확인' }).click();
  await expect(page).toHaveURL(/\/reference-data$/);
  await expect(
    page.getByRole('heading', { name: '기준 데이터 준비 상태' })
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
  await page
    .getByRole('heading', { name: '표시할 재무제표가 없습니다' })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]')
    .getByRole('link', { name: '운영 월 보기' })
    .click();
  await expect(page).toHaveURL(/\/periods$/);

  await page.goto('/carry-forwards');
  await expect(page).toHaveURL(/\/carry-forwards$/);
  await expect(page.getByText('표시할 차기 이월이 없습니다')).toBeVisible();
  await page.getByRole('link', { name: '재무제표 보기' }).first().click();
  await expect(page).toHaveURL(/\/financial-statements$/);

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});
