import { expect, test } from '@playwright/test';
import type {
  CreateInsurancePolicyRequest,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import {
  buildInsurancePolicyItemFromPayload,
  buildInsuranceRecurringRuleItemFromPolicyPayload,
  createE2ECategories,
  createE2ECurrentUser,
  createE2EFundingAccounts,
  createE2EInsurancePolicies,
  createE2ERecurringRules,
  mergeInsurancePoliciesForE2E,
  mergeRecurringRulesForE2E
} from '../support/auth-transactions-fixtures';
import {
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';

test('manages insurance policies through the insurance policies UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const newInsuranceProductName = `E2E 보험 계약 ${Date.now()}`;
  const renamedInsuranceProductName = `${newInsuranceProductName} 수정`;
  const currentUser = createE2ECurrentUser();
  let sessionActive = false;
  const fundingAccounts = createE2EFundingAccounts();
  const categories = createE2ECategories();
  let recurringRules = createE2ERecurringRules();
  let insurancePolicies = createE2EInsurancePolicies();

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

    if (path === '/api/recurring-rules' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recurringRules)
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

    if (path === '/api/insurance-policies' && request.method() === 'GET') {
      const includeInactive =
        url.searchParams.get('includeInactive') === 'true';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          includeInactive
            ? insurancePolicies
            : insurancePolicies.filter((policy) => policy.isActive)
        )
      });
      return;
    }

    if (path === '/api/insurance-policies' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateInsurancePolicyRequest;
      const seedToken = Date.now();
      const linkedRecurringRuleId = `rr-insurance-${seedToken}`;
      const created = buildInsurancePolicyItemFromPayload(payload, {
        id: `policy-e2e-${seedToken}`,
        fundingAccounts,
        categories,
        linkedRecurringRuleId
      });
      const syncedRecurringRule =
        buildInsuranceRecurringRuleItemFromPolicyPayload(payload, {
          id: linkedRecurringRuleId,
          insurancePolicyId: created.id,
          fundingAccounts,
          categories
        });

      recurringRules = mergeRecurringRulesForE2E(
        recurringRules,
        syncedRecurringRule
      );
      insurancePolicies = mergeInsurancePoliciesForE2E(
        insurancePolicies,
        created
      );

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (
      path.startsWith('/api/insurance-policies/') &&
      request.method() === 'PATCH'
    ) {
      const insurancePolicyId = path.split('/').at(-1) ?? '';
      const payload = request.postDataJSON() as UpdateInsurancePolicyRequest;
      const existingPolicy =
        insurancePolicies.find((policy) => policy.id === insurancePolicyId) ??
        null;
      const linkedRecurringRuleId =
        existingPolicy?.linkedRecurringRuleId ?? `rr-insurance-${Date.now()}`;
      const updated = buildInsurancePolicyItemFromPayload(payload, {
        id: insurancePolicyId,
        fundingAccounts,
        categories,
        linkedRecurringRuleId
      });
      const syncedRecurringRule =
        buildInsuranceRecurringRuleItemFromPolicyPayload(payload, {
          id: linkedRecurringRuleId,
          insurancePolicyId: updated.id,
          fundingAccounts,
          categories
        });

      recurringRules = mergeRecurringRulesForE2E(
        recurringRules,
        syncedRecurringRule
      );
      insurancePolicies = mergeInsurancePoliciesForE2E(
        insurancePolicies,
        updated
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (
      path.startsWith('/api/insurance-policies/') &&
      request.method() === 'DELETE'
    ) {
      const insurancePolicyId = path.split('/').at(-1) ?? '';
      const existingPolicy =
        insurancePolicies.find((policy) => policy.id === insurancePolicyId) ??
        null;

      insurancePolicies = insurancePolicies.filter(
        (policy) => policy.id !== insurancePolicyId
      );
      recurringRules = recurringRules.filter(
        (rule) => rule.linkedInsurancePolicyId !== insurancePolicyId
      );

      await route.fulfill({
        status: existingPolicy ? 204 : 404,
        contentType: 'application/json',
        body: existingPolicy
          ? ''
          : JSON.stringify({ message: 'Insurance policy not found' })
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

  await page.goto('/insurances');
  await expect(
    page.getByRole('heading', { name: '워크스페이스에 로그인' })
  ).toBeVisible();

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/insurances$/);
  await expect(
    page.getByRole('heading', { name: '보험 계약', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '보험 계약 등록' })
  ).toBeVisible();

  await page.getByRole('button', { name: '보험 계약 등록' }).click();
  await expect(
    page.getByRole('heading', { name: '보험 계약 등록' })
  ).toBeVisible();
  const insurancePolicyForm = page.locator('form');
  await insurancePolicyForm
    .getByRole('textbox', { name: '보험사' })
    .fill('메리츠화재');
  await insurancePolicyForm
    .getByRole('textbox', { name: '상품명' })
    .fill(newInsuranceProductName);
  await insurancePolicyForm.getByLabel('월 보험료 (원)').fill('88000');
  await insurancePolicyForm.getByRole('combobox', { name: '자금수단' }).click();
  await page.getByRole('option', { name: '사업 운영 통장' }).click();
  await insurancePolicyForm
    .getByRole('combobox', { name: '지출 카테고리' })
    .click();
  await page.getByRole('option', { name: '보험료' }).click();
  await insurancePolicyForm.getByLabel('반복 시작일').fill('2026-04-25');
  await insurancePolicyForm.getByLabel('갱신일').fill('2026-10-15');
  await insurancePolicyForm
    .getByRole('button', { name: '보험 계약 저장' })
    .click();

  await expect(
    page.getByText(
      `${newInsuranceProductName} 보험 계약과 연결 규칙을 등록했습니다.`
    )
  ).toBeVisible();
  const newInsurancePolicyRow = page.getByRole('row', {
    name: new RegExp(newInsuranceProductName)
  });
  await expect(
    page.getByRole('gridcell', { name: newInsuranceProductName, exact: true })
  ).toBeVisible();
  await expect(
    newInsurancePolicyRow.getByText('연결됨', { exact: true })
  ).toBeVisible();

  await page.goto('/recurring');
  await expect(page).toHaveURL(/\/recurring$/);
  await expect(
    page.getByRole('gridcell', {
      name: `메리츠화재 ${newInsuranceProductName}`,
      exact: true
    })
  ).toBeVisible();

  await page.goto('/insurances');
  await expect(page).toHaveURL(/\/insurances$/);
  await page
    .getByRole('row', { name: new RegExp(newInsuranceProductName) })
    .getByRole('button', { name: '수정' })
    .click();
  await expect(
    page.getByRole('heading', { name: '보험 계약 수정' })
  ).toBeVisible();
  await insurancePolicyForm
    .getByRole('textbox', { name: '상품명' })
    .fill(renamedInsuranceProductName);
  await insurancePolicyForm.getByRole('combobox', { name: '상태' }).click();
  await page.getByRole('option', { name: '비활성' }).click();
  await insurancePolicyForm
    .getByRole('button', { name: '보험 계약 수정' })
    .click();

  await expect(
    page.getByText(
      `${renamedInsuranceProductName} 보험 계약과 연결 규칙을 수정했습니다.`
    )
  ).toBeVisible();
  const renamedInsurancePolicyRow = page.getByRole('row', {
    name: new RegExp(renamedInsuranceProductName)
  });
  await expect(
    renamedInsurancePolicyRow.getByText('비활성', { exact: true })
  ).toBeVisible();
  await expect(
    renamedInsurancePolicyRow.getByText('연결됨', { exact: true })
  ).toBeVisible();

  await page.goto('/recurring');
  await expect(page).toHaveURL(/\/recurring$/);
  const renamedRecurringRuleRow = page.getByRole('row', {
    name: new RegExp(renamedInsuranceProductName)
  });
  await expect(
    page.getByRole('gridcell', {
      name: `메리츠화재 ${renamedInsuranceProductName}`,
      exact: true
    })
  ).toBeVisible();
  await expect(
    renamedRecurringRuleRow.getByText('중지', { exact: true })
  ).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});
