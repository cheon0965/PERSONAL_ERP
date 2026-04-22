import { expect, test } from '@playwright/test';
import type {
  CreateVehicleFuelLogRequest,
  CreateVehicleMaintenanceLogRequest,
  CreateVehicleRequest,
  UpdateVehicleFuelLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest
} from '@personal-erp/contracts';
import {
  buildVehicleFuelLogItemFromPayload,
  buildVehicleItemFromPayload,
  buildVehicleMaintenanceLogItemFromPayload,
  createE2ECurrentUser,
  createE2EVehicleFuelLogs,
  createE2EVehicleMaintenanceLogs,
  createE2EVehicles,
  mergeVehicleFuelLogsForE2E,
  mergeVehicleMaintenanceLogsForE2E,
  mergeVehiclesForE2E
} from '../support/auth-transactions-fixtures';
import {
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';
import { buildVehicleOperatingSummaryView } from '../../src/features/vehicles/vehicles.summary';

test('manages vehicles through the vehicles UI', async ({ page }) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const newVehicleName = `E2E 차량 ${Date.now()}`;
  const renamedVehicleName = `${newVehicleName} 수정`;
  const newFuelAmountWon = 76_431;
  const updatedFuelAmountWon = 81_234;
  const newMaintenanceDescription = `엔진오일 교체 ${Date.now()}`;
  const renamedMaintenanceDescription = `${newMaintenanceDescription} 완료`;
  const currentUser = createE2ECurrentUser();
  let sessionActive = false;
  let vehicles = createE2EVehicles();
  let fuelLogs = createE2EVehicleFuelLogs();
  let maintenanceLogs = createE2EVehicleMaintenanceLogs();
  const fundingAccounts = [
    {
      id: 'vehicle-funding-account-1',
      name: '사업 운영 통장',
      type: 'BANK',
      balanceWon: 2_450_000,
      status: 'ACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    }
  ];
  const categories = [
    {
      id: 'vehicle-fuel-category-1',
      name: '차량 연료비',
      kind: 'EXPENSE',
      isActive: true
    },
    {
      id: 'vehicle-maintenance-category-1',
      name: '차량 정비비',
      kind: 'EXPENSE',
      isActive: true
    }
  ];

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

    if (path === '/api/vehicles' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(vehicles)
      });
      return;
    }

    if (
      path === '/api/vehicles/operating-summary' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildVehicleOperatingSummaryView({
            vehicles,
            fuelLogs,
            maintenanceLogs
          })
        )
      });
      return;
    }

    if (path === '/api/vehicles' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateVehicleRequest;
      const created = buildVehicleItemFromPayload(payload, {
        id: `vehicle-e2e-${Date.now()}`
      });

      vehicles = mergeVehiclesForE2E(vehicles, created);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (path === '/api/vehicles/fuel-logs' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fuelLogs)
      });
      return;
    }

    if (
      /^\/api\/vehicles\/[^/]+\/fuel-logs$/.test(path) &&
      request.method() === 'POST'
    ) {
      const pathSegments = path.split('/').filter(Boolean);
      const vehicleId = pathSegments[2] ?? '';
      const payload = request.postDataJSON() as CreateVehicleFuelLogRequest;
      const vehicle =
        vehicles.find((candidate) => candidate.id === vehicleId) ?? null;
      const created = buildVehicleFuelLogItemFromPayload(payload, {
        id: `fuel-e2e-${Date.now()}`,
        vehicleId,
        vehicleName: vehicle?.name ?? '알 수 없는 차량'
      });

      fuelLogs = mergeVehicleFuelLogsForE2E(fuelLogs, created);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created)
      });
      return;
    }

    if (
      /^\/api\/vehicles\/[^/]+\/fuel-logs\/[^/]+$/.test(path) &&
      request.method() === 'PATCH'
    ) {
      const pathSegments = path.split('/').filter(Boolean);
      const vehicleId = pathSegments[2] ?? '';
      const fuelLogId = pathSegments[4] ?? '';
      const payload = request.postDataJSON() as UpdateVehicleFuelLogRequest;
      const currentFuelLog =
        fuelLogs.find((fuelLog) => fuelLog.id === fuelLogId) ?? null;
      const updated = buildVehicleFuelLogItemFromPayload(payload, {
        id: fuelLogId,
        vehicleId,
        vehicleName: currentFuelLog?.vehicleName ?? '알 수 없는 차량'
      });

      fuelLogs = mergeVehicleFuelLogsForE2E(fuelLogs, updated);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (
      path === '/api/vehicles/maintenance-logs' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(maintenanceLogs)
      });
      return;
    }

    if (
      /^\/api\/vehicles\/[^/]+\/maintenance-logs$/.test(path) &&
      request.method() === 'POST'
    ) {
      const pathSegments = path.split('/').filter(Boolean);
      const vehicleId = pathSegments[2] ?? '';
      const payload =
        request.postDataJSON() as CreateVehicleMaintenanceLogRequest;
      const vehicle =
        vehicles.find((candidate) => candidate.id === vehicleId) ?? null;
      const created = buildVehicleMaintenanceLogItemFromPayload(payload, {
        id: `maintenance-e2e-${Date.now()}`,
        vehicleId,
        vehicleName: vehicle?.name ?? '알 수 없는 차량'
      });

      maintenanceLogs = mergeVehicleMaintenanceLogsForE2E(
        maintenanceLogs,
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
      /^\/api\/vehicles\/[^/]+\/maintenance-logs\/[^/]+$/.test(path) &&
      request.method() === 'PATCH'
    ) {
      const pathSegments = path.split('/').filter(Boolean);
      const vehicleId = pathSegments[2] ?? '';
      const maintenanceLogId = pathSegments[4] ?? '';
      const payload =
        request.postDataJSON() as UpdateVehicleMaintenanceLogRequest;
      const currentMaintenanceLog =
        maintenanceLogs.find(
          (maintenanceLog) => maintenanceLog.id === maintenanceLogId
        ) ?? null;
      const updated = buildVehicleMaintenanceLogItemFromPayload(payload, {
        id: maintenanceLogId,
        vehicleId,
        vehicleName: currentMaintenanceLog?.vehicleName ?? '알 수 없는 차량'
      });

      maintenanceLogs = mergeVehicleMaintenanceLogsForE2E(
        maintenanceLogs,
        updated
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
      });
      return;
    }

    if (/^\/api\/vehicles\/[^/]+$/.test(path) && request.method() === 'PATCH') {
      const vehicleId = path.split('/').at(-1) ?? '';
      const payload = request.postDataJSON() as UpdateVehicleRequest;
      const updated = buildVehicleItemFromPayload(payload, {
        id: vehicleId
      });

      vehicles = mergeVehiclesForE2E(vehicles, updated);
      fuelLogs = fuelLogs.map((fuelLog) =>
        fuelLog.vehicleId === vehicleId
          ? {
              ...fuelLog,
              vehicleName: updated.name
            }
          : fuelLog
      );
      maintenanceLogs = maintenanceLogs.map((maintenanceLog) =>
        maintenanceLog.vehicleId === vehicleId
          ? {
              ...maintenanceLog,
              vehicleName: updated.name
            }
          : maintenanceLog
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated)
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

  await page.goto('/vehicles');
  await expect(
    page.getByRole('heading', { name: '운영 포털 로그인' })
  ).toBeVisible();

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/vehicles$/);
  await expect(
    page.getByRole('heading', { name: '차량 운영', exact: true })
  ).toBeVisible();
  await page.goto('/vehicles/fleet');
  await expect(page).toHaveURL(/\/vehicles\/fleet$/);
  await expect(
    page.getByRole('heading', { name: '차량 목록', exact: true })
  ).toBeVisible();
  const vehicleTableCard = page
    .getByRole('heading', { name: '차량 기본 정보', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]');

  await vehicleTableCard.getByRole('button', { name: '차량 등록' }).click();
  await expect(page.getByRole('heading', { name: '차량 등록' })).toBeVisible();
  const vehicleForm = page.locator('form');
  await vehicleForm
    .getByRole('textbox', { name: '차량명' })
    .fill(newVehicleName);
  await vehicleForm.getByRole('textbox', { name: '제조사' }).fill('Kia');
  await vehicleForm.getByLabel('초기 주행거리 (km)').fill('12400');
  await vehicleForm.getByLabel('예상 연비 (km/L)').fill('14.8');
  await vehicleForm.getByRole('button', { name: '차량 저장' }).click();

  await expect(
    page.getByText(`${newVehicleName} 차량을 등록했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: newVehicleName, exact: true })
  ).toBeVisible();

  const newVehicleRow = vehicleTableCard.getByRole('row', {
    name: new RegExp(newVehicleName)
  });
  await newVehicleRow.getByRole('button', { name: '수정' }).click();
  await expect(page.getByRole('heading', { name: '차량 수정' })).toBeVisible();
  await vehicleForm
    .getByRole('textbox', { name: '차량명' })
    .fill(renamedVehicleName);
  await vehicleForm.getByRole('button', { name: '차량 수정' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 차량 정보를 수정했습니다.`)
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: renamedVehicleName, exact: true })
  ).toBeVisible();

  const renamedVehicleRow = vehicleTableCard.getByRole('row', {
    name: new RegExp(renamedVehicleName)
  });
  await renamedVehicleRow.getByRole('button', { name: '연료 기록' }).click();
  await expect(
    page.getByRole('heading', { name: '연료 기록 추가' })
  ).toBeVisible();
  const fuelForm = page.locator('form').last();
  await fuelForm.getByLabel('주유일').fill('2026-03-27');
  await fuelForm.getByLabel('주유 시점 주행거리 (km)').fill('58910');
  await fuelForm.getByLabel('주유량 (L)').fill('44.2');
  await fuelForm.getByLabel('주유 금액 (원)').fill(String(newFuelAmountWon));
  await fuelForm.getByLabel('리터당 단가 (원)').fill('1729');
  await fuelForm.getByRole('button', { name: '연료 기록 저장' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 연료 기록을 추가했습니다.`)
  ).toBeVisible();
  await page.goto('/vehicles/fuel');
  await expect(page).toHaveURL(/\/vehicles\/fuel$/);
  await expect(
    page.getByRole('heading', { name: '연료 기록', exact: true })
  ).toBeVisible();
  const fuelTableCard = page
    .getByRole('heading', { name: '주유 / 충전 기록', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]');
  const createdFuelRow = fuelTableCard.getByRole('row', {
    name: new RegExp(`${renamedVehicleName}.*76,431`)
  });
  await expect(createdFuelRow).toBeVisible();
  await expect(
    createdFuelRow.getByRole('gridcell', {
      name: '₩76,431',
      exact: true
    })
  ).toBeVisible();

  await createdFuelRow.getByRole('button', { name: '수정' }).click();
  await expect(
    page.getByRole('heading', { name: '연료 기록 수정' })
  ).toBeVisible();
  const fuelEditForm = page.locator('form').last();
  await fuelEditForm.getByLabel('주유일').fill('2026-03-28');
  await fuelEditForm
    .getByLabel('주유 금액 (원)')
    .fill(String(updatedFuelAmountWon));
  await fuelEditForm
    .getByRole('checkbox', { name: '가득 주유 / 완충 기록' })
    .uncheck();
  await fuelEditForm.getByRole('button', { name: '연료 기록 수정' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 연료 기록을 수정했습니다.`)
  ).toBeVisible();
  const updatedFuelRow = fuelTableCard.getByRole('row', {
    name: new RegExp(`${renamedVehicleName}.*81,234`)
  });
  await expect(updatedFuelRow).toBeVisible();
  await expect(
    updatedFuelRow.getByRole('gridcell', {
      name: '₩81,234',
      exact: true
    })
  ).toBeVisible();

  await page.goto('/vehicles/fleet');
  await expect(page).toHaveURL(/\/vehicles\/fleet$/);
  const refreshedVehicleRow = vehicleTableCard.getByRole('row', {
    name: new RegExp(renamedVehicleName)
  });
  await refreshedVehicleRow.getByRole('button', { name: '정비 기록' }).click();
  await expect(
    page.getByRole('heading', { name: '정비 기록 추가' })
  ).toBeVisible();
  const maintenanceForm = page.locator('form').last();
  await maintenanceForm.getByLabel('정비일').fill('2026-03-26');
  await maintenanceForm.getByLabel('정비 시점 주행거리 (km)').fill('58940');
  await maintenanceForm.getByLabel('정비 비용 (원)').fill('198000');
  await maintenanceForm
    .getByRole('textbox', { name: '정비처' })
    .fill('현대 블루핸즈');
  await maintenanceForm
    .getByRole('textbox', { name: '정비 내용' })
    .fill(newMaintenanceDescription);
  await maintenanceForm
    .getByRole('textbox', { name: '메모' })
    .fill('엔진오일과 필터를 함께 교체했습니다.');
  await maintenanceForm.getByRole('button', { name: '정비 저장' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 정비 기록을 추가했습니다.`)
  ).toBeVisible();
  await page.goto('/vehicles/maintenance');
  await expect(page).toHaveURL(/\/vehicles\/maintenance$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '정비 이력', exact: true })
  ).toBeVisible();
  const maintenanceTableCard = page
    .getByRole('heading', { level: 6, name: '정비 이력', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]');
  const createdMaintenanceRow = maintenanceTableCard.getByRole('row', {
    name: new RegExp(newMaintenanceDescription)
  });
  await expect(createdMaintenanceRow).toBeVisible();
  await expect(
    createdMaintenanceRow.getByRole('gridcell', {
      name: '₩198,000',
      exact: true
    })
  ).toBeVisible();

  await createdMaintenanceRow.getByRole('button', { name: '수정' }).click();
  await expect(
    page.getByRole('heading', { name: '정비 기록 수정' })
  ).toBeVisible();
  const maintenanceEditForm = page.locator('form').last();
  await maintenanceEditForm
    .getByRole('textbox', { name: '정비 내용' })
    .fill(renamedMaintenanceDescription);
  await maintenanceEditForm.getByLabel('정비 비용 (원)').fill('212000');
  await maintenanceEditForm.getByRole('button', { name: '정비 수정' }).click();

  await expect(
    page.getByText(`${renamedVehicleName} 정비 기록을 수정했습니다.`)
  ).toBeVisible();
  const renamedMaintenanceRow = maintenanceTableCard.getByRole('row', {
    name: new RegExp(renamedMaintenanceDescription)
  });
  await expect(renamedMaintenanceRow).toBeVisible();
  await expect(
    renamedMaintenanceRow.getByRole('gridcell', {
      name: '₩212,000',
      exact: true
    })
  ).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});
