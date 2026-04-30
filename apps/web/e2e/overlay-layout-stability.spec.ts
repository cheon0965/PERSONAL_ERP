import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import type { CollectedTransactionItem } from '@personal-erp/contracts';
import {
  buildE2EAccountingPeriod,
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from './support/auth-transactions-common';
import {
  buildReferenceDataReadinessSummary,
  createE2ECategories,
  createE2ECurrentUser,
  createE2EFundingAccounts
} from './support/auth-transactions-fixtures';

type LayoutSnapshot = {
  bodyPaddingRight: string;
  headerLeft: number;
  isScrollable: boolean;
  mainLeft: number;
};

const e2eRootApiRoutePattern =
  /\/(auth|navigation|accounting-periods|funding-accounts|categories|reference-data|journal-entries|collected-transactions)(\/|$)/;

test('keeps the app horizontally stable while common overlays are open', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const currentUser = createE2ECurrentUser();
  const fundingAccounts = createE2EFundingAccounts();
  const categories = createE2ECategories();
  const currentPeriod = buildE2EAccountingPeriod({
    id: 'period-layout-stability',
    month: '2026-04',
    status: 'OPEN',
    openedAt: '2026-04-01T00:00:00.000Z',
    lockedAt: null,
    hasOpeningBalanceSnapshot: false,
    openingBalanceSourceKind: null,
    statusHistory: [
      {
        id: 'period-layout-stability-history',
        fromStatus: null,
        toStatus: 'OPEN',
        eventType: 'OPEN',
        reason: 'Playwright overlay layout stability setup',
        actorType: 'TENANT_MEMBERSHIP',
        actorMembershipId: 'membership-demo',
        changedAt: '2026-04-01T00:00:00.000Z'
      }
    ]
  });
  const referenceDataReadiness = buildReferenceDataReadinessSummary({
    fundingAccounts,
    categories
  });
  const transactions: CollectedTransactionItem[] = [
    {
      id: 'txn-overlay-layout-stability',
      businessDate: '2026-04-08',
      title: 'Overlay layout stability transaction',
      type: 'EXPENSE',
      amountWon: 12000,
      fundingAccountName: fundingAccounts[0]?.name ?? '-',
      categoryName: categories[0]?.name ?? '-',
      sourceKind: 'MANUAL',
      postingStatus: 'REVIEWED',
      postedJournalEntryId: null,
      postedJournalEntryNumber: null,
      matchedPlanItemId: null,
      matchedPlanItemTitle: null
    }
  ];

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  const handleApiRoute = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = normalizeE2EApiPath(url.pathname);

    if (path === '/api/auth/refresh' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'playwright-overlay-layout-token',
          user: currentUser
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

    if (path === '/api/auth/workspaces' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
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

    if (path === '/api/accounting-periods' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([currentPeriod])
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
  await page.route(e2eRootApiRoutePattern, handleApiRoute);

  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto('/transactions');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.MuiDataGrid-root')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight
      )
    )
    .toBe(true);

  const beforePopover = await readLayoutSnapshot(page);
  await page.getByRole('button', { name: '기준' }).click();
  await expect(page.locator('.MuiPopover-root')).toBeVisible();
  expectStableLayout(beforePopover, await readLayoutSnapshot(page));
  await page.keyboard.press('Escape');
  await expect(page.locator('.MuiPopover-root')).toHaveCount(0);

  const beforeDrawer = await readLayoutSnapshot(page);
  await page.locator('main button.MuiButton-contained').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expectStableLayout(beforeDrawer, await readLayoutSnapshot(page));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const beforeDialog = await readLayoutSnapshot(page);
  await page.locator('.MuiDataGrid-row button').nth(1).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expectStableLayout(beforeDialog, await readLayoutSnapshot(page));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.setViewportSize({ width: 1024, height: 720 });
  await expectNoDocumentHorizontalOverflow(page);
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeVisible();
  const beforeTabletNavigation = await readLayoutSnapshot(page);
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await expect(page.getByRole('button', { name: '메뉴 닫기' })).toBeVisible();
  await expect
    .poll(async () => {
      const drawerBox = await page
        .locator('.MuiDrawer-paper')
        .filter({ has: page.getByRole('button', { name: '메뉴 닫기' }) })
        .boundingBox();

      return Math.round(drawerBox?.width ?? 0);
    })
    .toBeGreaterThanOrEqual(330);
  expectStableLayout(beforeTabletNavigation, await readLayoutSnapshot(page));
  await page.getByRole('button', { name: '메뉴 닫기' }).click();
  await expect(page.getByRole('button', { name: '메뉴 닫기' })).toHaveCount(0);

  await page.setViewportSize({ width: 768, height: 720 });
  await expectNoDocumentHorizontalOverflow(page);
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 720 });
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeVisible();
  const beforeMobileNavigation = await readLayoutSnapshot(page);
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await expect(page.getByRole('button', { name: '메뉴 닫기' })).toBeVisible();
  await expect(page.getByText('표시할 메뉴가 없습니다.').last()).toBeVisible();
  expectStableLayout(beforeMobileNavigation, await readLayoutSnapshot(page));
  await page.getByRole('button', { name: '메뉴 닫기' }).click();
  await expect(page.getByRole('button', { name: '메뉴 닫기' })).toHaveCount(0);

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

async function readLayoutSnapshot(page: Page): Promise<LayoutSnapshot> {
  return page.evaluate(() => {
    const mainBox = document.querySelector('main')?.getBoundingClientRect();
    const headerBox = document.querySelector('header')?.getBoundingClientRect();

    return {
      bodyPaddingRight: window.getComputedStyle(document.body).paddingRight,
      headerLeft: headerBox?.left ?? 0,
      isScrollable: document.documentElement.scrollHeight > window.innerHeight,
      mainLeft: mainBox?.left ?? 0
    };
  });
}

function normalizeE2EApiPath(pathname: string) {
  return pathname.startsWith('/api/') ? pathname : `/api${pathname}`;
}

async function expectNoDocumentHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
}

function expectStableLayout(
  before: LayoutSnapshot,
  after: LayoutSnapshot
): void {
  expect(before.isScrollable).toBe(true);
  expect(after.bodyPaddingRight).toBe('0px');
  expect(Math.abs(after.headerLeft - before.headerLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.mainLeft - before.mainLeft)).toBeLessThanOrEqual(1);
}
