import { expect, test } from '@playwright/test';
import { createE2ECurrentUserWithoutWorkspace } from '../support/auth-transactions-fixtures';
import {
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';

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
