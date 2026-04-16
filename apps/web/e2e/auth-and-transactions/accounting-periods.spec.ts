import { expect, test } from '@playwright/test';
import type {
  AccountingPeriodItem,
  CloseAccountingPeriodRequest,
  CloseAccountingPeriodResponse,
  OpenAccountingPeriodRequest,
  ReopenAccountingPeriodRequest
} from '@personal-erp/contracts';
import {
  buildReferenceDataReadinessSummary,
  createE2EAccountSubjects,
  createE2ECategories,
  createE2ECurrentUser,
  createE2EFundingAccounts
} from '../support/auth-transactions-fixtures';
import {
  buildE2EAccountingPeriod,
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';

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
  await expect(
    page.getByRole('heading', { name: '워크스페이스에 로그인' })
  ).toBeVisible();

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/periods$/);
  await expect(
    page.getByRole('heading', { level: 4, name: '운영 기간', exact: true })
  ).toBeVisible();

  await page.goto('/periods/open');
  await expect(page).toHaveURL(/\/periods\/open$/);
  await expect(
    page.getByRole('heading', { level: 4, name: '월 운영 시작', exact: true })
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
  await page.goto('/periods/history');
  await expect(page).toHaveURL(/\/periods\/history$/);
  await expect(
    page.getByRole('gridcell', { name: '초기 설정' }).first()
  ).toBeVisible();

  await page.goto('/periods/close');
  await expect(page).toHaveURL(/\/periods\/close$/);
  await expect(
    page.getByRole('heading', {
      level: 4,
      name: '월 마감 / 재오픈',
      exact: true
    })
  ).toBeVisible();
  await page.getByLabel('마감 메모').fill('E2E 월 마감');
  await page.getByRole('button', { name: '월 마감', exact: true }).click();

  await expect(page.getByText('2026-05 월 마감을 완료했습니다.')).toBeVisible();
  await expect(
    page.getByText('2026-05 월 마감이 완료되었습니다.')
  ).toBeVisible();
  await expect(page.getByText('LOCKED').first()).toBeVisible();

  await page.getByLabel('재오픈 사유').fill('E2E 정정 준비');
  await page.getByRole('button', { name: '월 재오픈', exact: true }).click();

  await expect(page.getByText('2026-05 월을 재오픈했습니다.')).toBeVisible();
  await expect(page.getByText('E2E 정정 준비')).toBeVisible();
  await expect(page.getByText('OPEN').first()).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});
