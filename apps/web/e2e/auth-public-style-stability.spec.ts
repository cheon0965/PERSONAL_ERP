import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import type { DashboardSummary } from '@personal-erp/contracts';
import {
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from './support/auth-transactions-common';
import {
  demoLoginCredentials,
  demoLoginPath
} from '../src/features/auth/model/demo-login';
import { createE2ECurrentUser } from './support/auth-transactions-fixtures';

const dashboardSummary: DashboardSummary = {
  period: {
    id: 'period-style-stability',
    year: 2026,
    month: 4,
    monthLabel: '2026-04',
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-05-01T00:00:00.000Z',
    status: 'OPEN',
    openedAt: '2026-04-01T00:00:00.000Z',
    lockedAt: null,
    hasOpeningBalanceSnapshot: true,
    openingBalanceSourceKind: 'CARRY_FORWARD',
    statusHistory: []
  },
  basisStatus: 'LIVE_OPERATIONS',
  actualBalanceWon: 3_180_000,
  confirmedIncomeWon: 3_200_000,
  confirmedExpenseWon: 1_465_000,
  remainingPlannedIncomeWon: 0,
  remainingPlannedExpenseWon: 540_000,
  minimumReserveWon: 400_000,
  expectedMonthEndBalanceWon: 2_640_000,
  safetySurplusWon: 2_240_000,
  warnings: [],
  highlights: [
    { label: '예상 기간말 잔액', amountWon: 2_640_000, tone: 'POSITIVE' },
    { label: '안전 잉여', amountWon: 2_240_000, tone: 'POSITIVE' }
  ],
  trend: [
    {
      periodId: 'period-style-stability',
      monthLabel: '2026-04',
      periodStatus: 'OPEN',
      incomeWon: 3_200_000,
      expenseWon: 1_465_000,
      plannedIncomeWon: 0,
      plannedExpenseWon: 540_000,
      periodPnLWon: 1_735_000,
      cashWon: 3_180_000,
      netWorthWon: null,
      isOfficial: false
    }
  ],
  officialComparison: null
};

test('keeps public and login styles valid after login and logout', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const currentUser = createE2ECurrentUser();
  let sessionActive = false;

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  const handleApiRoute = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = normalizeE2EApiPath(url.pathname);

    if (path === '/api/auth/login' && request.method() === 'POST') {
      sessionActive = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'playwright-style-login-token',
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
          body: JSON.stringify({ message: 'Missing refresh token' })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'playwright-style-refresh-token',
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
        body: JSON.stringify({ status: 'logged_out' })
      });
      return;
    }

    if (path === '/api/auth/workspaces' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: currentUser.currentWorkspace
            ? [{ ...currentUser.currentWorkspace, isCurrent: true }]
            : []
        })
      });
      return;
    }

    if (path === '/api/navigation/tree' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
      });
      return;
    }

    if (path === '/api/dashboard/summary' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(dashboardSummary)
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
  };

  await page.route(e2eApiRoutePattern, handleApiRoute);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  const initialStyleNonce = await readSingleMuiStyleNonce(page);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole('heading', { name: '월 운영 대시보드' })
  ).toBeVisible();

  await page.getByRole('button', { name: /Demo User/ }).click();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await expectMuiStylesUseSingleNonce(page, initialStyleNonce);

  await page.getByRole('link', { name: /PERSONAL ERP 로고/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', {
      name: /개인사업자와 소상공인의 월별 재무 운영/
    })
  ).toBeVisible();
  await expect(page.getByText('https://personalerp.theworkpc.com')).toHaveCount(
    0
  );
  await expect(
    page.getByRole('link', {
      name: 'github.com/cheon0965/PERSONAL_ERP'
    })
  ).toBeVisible();
  await expectMuiStylesUseSingleNonce(page, initialStyleNonce);

  await page.getByRole('link', { name: '데모로 둘러보기' }).first().click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(demoLoginPath)}$`));
  await expect(page.getByLabel('이메일')).toHaveValue(
    demoLoginCredentials.email
  );
  await expect(page.getByLabel('비밀번호')).toHaveValue(
    demoLoginCredentials.password
  );
  await expect(page.getByRole('button', { name: '로그인' })).toBeEnabled();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

function normalizeE2EApiPath(pathname: string) {
  return pathname.startsWith('/api/') ? pathname : `/api${pathname}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readSingleMuiStyleNonce(page: Page): Promise<string> {
  const nonces = await readMuiStyleNonces(page);

  expect(nonces.length).toBeGreaterThan(0);
  expect(Array.from(new Set(nonces))).toHaveLength(1);

  return nonces[0] ?? '';
}

async function expectMuiStylesUseSingleNonce(
  page: Page,
  expectedNonce: string
): Promise<void> {
  await expect
    .poll(async () => Array.from(new Set(await readMuiStyleNonces(page))))
    .toEqual([expectedNonce]);
}

async function readMuiStyleNonces(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLStyleElement>('style[data-emotion]')
    )
      .map((style) => style.nonce)
      .filter(
        (nonce): nonce is string =>
          typeof nonce === 'string' && nonce.length > 0
      )
  );
}
