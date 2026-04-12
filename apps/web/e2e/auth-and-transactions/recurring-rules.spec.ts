import { expect, test } from '@playwright/test';
import type {
  CreateRecurringRuleRequest,
  UpdateRecurringRuleRequest
} from '@personal-erp/contracts';
import {
  buildRecurringRuleDetailFromItem,
  buildRecurringRuleItemFromPayload,
  createE2ECategories,
  createE2ECurrentUser,
  createE2EFundingAccounts,
  createE2ERecurringRules,
  mergeRecurringRulesForE2E
} from '../support/auth-transactions-fixtures';
import {
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';

test('manages recurring rules through the recurring rules UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const newRecurringRuleTitle = `E2E 반복 규칙 ${Date.now()}`;
  const renamedRecurringRuleTitle = `${newRecurringRuleTitle} 수정`;
  const currentUser = createE2ECurrentUser();
  let sessionActive = false;
  const fundingAccounts = createE2EFundingAccounts();
  const categories = createE2ECategories();
  let recurringRules = createE2ERecurringRules();

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

    if (path === '/api/recurring-rules' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recurringRules)
      });
      return;
    }

    if (path === '/api/recurring-rules' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateRecurringRuleRequest;
      const created = buildRecurringRuleItemFromPayload(payload, {
        id: `rr-e2e-${Date.now()}`,
        fundingAccounts,
        categories
      });

      recurringRules = mergeRecurringRulesForE2E(recurringRules, created);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (
      path.startsWith('/api/recurring-rules/') &&
      request.method() === 'GET'
    ) {
      const recurringRuleId = path.split('/').at(-1) ?? '';
      const detail = buildRecurringRuleDetailFromItem(
        recurringRules.find((rule) => rule.id === recurringRuleId) ?? null,
        {
          fundingAccounts,
          categories
        }
      );

      if (!detail) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Recurring rule not found' })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detail)
      });
      return;
    }

    if (
      path.startsWith('/api/recurring-rules/') &&
      request.method() === 'PATCH'
    ) {
      const recurringRuleId = path.split('/').at(-1) ?? '';
      const payload = request.postDataJSON() as UpdateRecurringRuleRequest;
      const updated = buildRecurringRuleItemFromPayload(payload, {
        id: recurringRuleId,
        fundingAccounts,
        categories
      });

      recurringRules = mergeRecurringRulesForE2E(recurringRules, updated);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (
      path.startsWith('/api/recurring-rules/') &&
      request.method() === 'DELETE'
    ) {
      const recurringRuleId = path.split('/').at(-1);
      recurringRules = recurringRules.filter(
        (rule) => rule.id !== recurringRuleId
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'null'
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

  await page.goto('/recurring');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/recurring$/);
  await expect(page.getByRole('heading', { name: '반복 규칙' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '반복 규칙 등록' }).first()
  ).toBeVisible();

  await page.getByRole('button', { name: '반복 규칙 등록' }).first().click();
  await expect(
    page.getByRole('heading', { name: '반복 규칙 등록' })
  ).toBeVisible();
  await page.getByLabel('규칙명').fill(newRecurringRuleTitle);
  await page.getByLabel('금액 (원)').fill('88888');
  await page.getByLabel('시작일').fill('2026-04-15');
  await page
    .locator('form')
    .getByRole('button', { name: '반복 규칙 저장' })
    .click();

  await expect(
    page.getByText(`${newRecurringRuleTitle} 반복 규칙을 등록했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: newRecurringRuleTitle, exact: true })
  ).toBeVisible();

  const newRecurringRuleRow = page.getByRole('row', {
    name: new RegExp(newRecurringRuleTitle)
  });
  await newRecurringRuleRow.getByRole('button', { name: '수정' }).click();
  await expect(
    page.getByRole('heading', { name: '반복 규칙 수정' })
  ).toBeVisible();
  await page.getByLabel('규칙명').fill(renamedRecurringRuleTitle);
  await page.locator('form').getByRole('combobox', { name: '상태' }).click();
  await page.getByRole('option', { name: '일시중지' }).click();
  await page
    .locator('form')
    .getByRole('button', { name: '반복 규칙 수정' })
    .click();

  await expect(
    page.getByText(`${renamedRecurringRuleTitle} 반복 규칙을 수정했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', {
      name: renamedRecurringRuleTitle,
      exact: true
    })
  ).toBeVisible();
  const renamedRecurringRuleRow = page.getByRole('row', {
    name: new RegExp(renamedRecurringRuleTitle)
  });
  await expect(
    renamedRecurringRuleRow.getByText('중지', { exact: true })
  ).toBeVisible();

  await renamedRecurringRuleRow.getByRole('button', { name: '삭제' }).click();
  await expect(
    page.getByRole('heading', { name: '반복 규칙 삭제' })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '삭제', exact: true })
    .click();

  await expect(
    page.getByText(`${renamedRecurringRuleTitle} 반복 규칙을 삭제했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', {
      name: renamedRecurringRuleTitle,
      exact: true
    })
  ).toHaveCount(0);

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});
