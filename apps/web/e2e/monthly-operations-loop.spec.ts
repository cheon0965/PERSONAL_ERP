import { expect, test, type Page } from '@playwright/test';
import { createE2ECurrentUser } from './support/auth-transactions-fixtures';
import {
  createCarryForwardView,
  createDashboardSummary,
  createEmptyPlanItemsView,
  createFinancialStatementsView,
  createForecastResponse,
  createGeneratedPlanItemsResponse,
  createMonthlyOperationsPeriods
} from './support/monthly-operations-fixtures';

const e2eApiRoutePattern = '**/api/**';

function expectNoPageErrors(pageErrors: string[]) {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
}

function expectNoUnhandledApiRequests(unhandledApiRequests: string[]) {
  expect(unhandledApiRequests, unhandledApiRequests.join('\n\n')).toEqual([]);
}

async function installMonthlyOperationsRoutes(page: Page) {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const currentUser = createE2ECurrentUser();
  const periods = createMonthlyOperationsPeriods();
  const generatedPlanItems = createGeneratedPlanItemsResponse(
    periods.openAfterCarryForward
  );
  const generatedFinancialStatements = createFinancialStatementsView({
    period: periods.reportingLocked,
    previousPeriod: periods.previousLocked
  });
  const generatedCarryForward = createCarryForwardView({
    sourcePeriod: periods.reportingLocked,
    targetPeriod: periods.openAfterCarryForward
  });

  let sessionActive = false;
  let planItemsGenerated = false;
  let financialStatementsGenerated = false;
  let carryForwardGenerated = false;

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
      path === '/api/accounting-periods/current' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          carryForwardGenerated
            ? periods.openAfterCarryForward
            : periods.openBeforeCarryForward
        )
      });
      return;
    }

    if (path === '/api/accounting-periods' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          periods.reportingLocked,
          periods.previousLocked,
          carryForwardGenerated
            ? periods.openAfterCarryForward
            : periods.openBeforeCarryForward
        ])
      });
      return;
    }

    if (path === '/api/plan-items' && request.method() === 'GET') {
      const requestedPeriodId = url.searchParams.get('periodId');
      const currentOpenPeriod = carryForwardGenerated
        ? periods.openAfterCarryForward
        : periods.openBeforeCarryForward;
      const body =
        requestedPeriodId === currentOpenPeriod.id
          ? planItemsGenerated
            ? {
                period: currentOpenPeriod,
                items: generatedPlanItems.items,
                summary: generatedPlanItems.summary
              }
            : createEmptyPlanItemsView(currentOpenPeriod)
          : null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
      return;
    }

    if (path === '/api/plan-items/generate' && request.method() === 'POST') {
      planItemsGenerated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ...generatedPlanItems,
          period: carryForwardGenerated
            ? periods.openAfterCarryForward
            : periods.openBeforeCarryForward
        })
      });
      return;
    }

    if (path === '/api/dashboard/summary' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createDashboardSummary({
            period: carryForwardGenerated
              ? periods.openAfterCarryForward
              : periods.openBeforeCarryForward,
            previousLockedPeriod: periods.reportingLocked,
            planItemsGenerated,
            carryForwardGenerated
          })
        )
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

    if (path === '/api/forecast/monthly' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createForecastResponse({
            period: carryForwardGenerated
              ? periods.openAfterCarryForward
              : periods.openBeforeCarryForward,
            previousLockedPeriod: periods.reportingLocked,
            planItemsGenerated,
            carryForwardGenerated
          })
        )
      });
      return;
    }

    if (path === '/api/financial-statements' && request.method() === 'GET') {
      const requestedPeriodId = url.searchParams.get('periodId');
      const body =
        requestedPeriodId === periods.reportingLocked.id &&
        financialStatementsGenerated
          ? generatedFinancialStatements
          : null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
      return;
    }

    if (
      path === '/api/financial-statements/generate' &&
      request.method() === 'POST'
    ) {
      financialStatementsGenerated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(generatedFinancialStatements)
      });
      return;
    }

    if (path === '/api/carry-forwards' && request.method() === 'GET') {
      const requestedPeriodId = url.searchParams.get('fromPeriodId');
      const body =
        requestedPeriodId === periods.reportingLocked.id &&
        carryForwardGenerated
          ? generatedCarryForward
          : null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
      return;
    }

    if (
      path === '/api/carry-forwards/generate' &&
      request.method() === 'POST'
    ) {
      carryForwardGenerated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(generatedCarryForward)
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

  return {
    pageErrors,
    unhandledApiRequests
  };
}

async function loginFrom(page: Page, path: string) {
  await page.goto(path);
  await expect(
    page.getByRole('heading', { name: '워크스페이스에 로그인' })
  ).toBeVisible();

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();
}

test('@smoke generates plan items and reflects them in the live dashboard and forecast', async ({
  page
}) => {
  const { pageErrors, unhandledApiRequests } =
    await installMonthlyOperationsRoutes(page);

  await loginFrom(page, '/dashboard');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: '월 운영 대시보드' })
  ).toBeVisible();
  await expect(page.getByText('2026-05 운영 월')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '운영 판단 기준' })
  ).toBeVisible();
  await expect(
    page.getByText(
      '아직 생성된 계획 항목이 없어 남은 계획 지출이 0원 기준으로 보입니다.'
    )
  ).toBeVisible();

  await page.goto('/forecast');
  await expect(page).toHaveURL(/\/forecast$/);
  await expect(
    page.getByRole('heading', { name: '기간 운영 전망' })
  ).toBeVisible();
  await expect(page.getByText('전망 기준')).toBeVisible();
  await expect(
    page.getByText(
      '아직 생성된 계획 항목이 없어 남은 계획 지출이 비어 있습니다.'
    )
  ).toBeVisible();

  await page.goto('/plan-items/generate');
  await expect(page).toHaveURL(/\/plan-items\/generate$/);
  await expect(
    page.getByRole('heading', { name: '계획 생성', exact: true })
  ).toBeVisible();

  await page
    .getByRole('heading', { name: '생성 대상' })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]')
    .getByRole('button', { name: '생성 실행' })
    .click();

  await expect(
    page.getByText(
      '2026-05 계획 항목을 생성했습니다. 신규 2건, 기존 유지 0건, 제외 규칙 0건입니다.'
    )
  ).toBeVisible();
  await page.goto('/plan-items');
  await expect(page).toHaveURL(/\/plan-items$/);
  await expect(
    page.getByRole('gridcell', { name: '5월 월세 자동 이체', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: '업무용 차량 보험료', exact: true })
  ).toBeVisible();

  await page.goto('/dashboard');
  await expect(
    page.getByText('생성된 계획 항목 2건이 현재 운영 월 전망에 반영됩니다.')
  ).toBeVisible();

  await page.goto('/forecast');
  await expect(
    page.getByText(
      '현재 선택한 기간에는 계획 항목 2건이 남은 계획 지출에 반영되어 있습니다.'
    )
  ).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});

test('@smoke generates official statements and carry-forwards for the locked monthly close', async ({
  page
}) => {
  const { pageErrors, unhandledApiRequests } =
    await installMonthlyOperationsRoutes(page);

  await loginFrom(page, '/financial-statements/period-2026-04');

  await expect(page).toHaveURL(/\/financial-statements\/period-2026-04$/);
  await expect(page.getByText('공식 스냅샷이 아직 없습니다')).toBeVisible();
  await page.getByRole('button', { name: '공식 재무제표 생성' }).click();

  await expect(
    page.getByText('2026-04 공식 재무제표 스냅샷을 생성했습니다.')
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '사업 재무상태표', exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('차기 이월 기록: carry-forward-2026-03-to-2026-04')
  ).toBeVisible();
  await expect(page.getByText('유동자산')).toBeVisible();

  await page.goto('/carry-forwards/period-2026-04');
  await expect(page).toHaveURL(/\/carry-forwards\/period-2026-04$/);
  await expect(page.getByText('차기 이월이 아직 없습니다')).toBeVisible();
  await page.getByRole('button', { name: '차기 이월 생성' }).click();

  await expect(
    page.getByText('2026-04 마감 결과를 2026-05 오프닝 기준으로 이월했습니다.')
  ).toBeVisible();
  await expect(page.getByText('현금및예금')).toBeVisible();
  await expect(page.getByText('미지급금')).toBeVisible();
  await expect(page.getByText('대상 운영 기간 상태')).toBeVisible();
  await expect(page.getByText('진행 중').first()).toBeVisible();

  await page.goto('/forecast');
  await expect(
    page.getByText('기초 잔액은 2026-04 차기 이월 기준입니다.')
  ).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});
