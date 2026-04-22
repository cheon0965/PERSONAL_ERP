import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

type RequestContext = Awaited<ReturnType<typeof createRequestTestContext>>;

function addOpenMarchVehicleAccountingPeriod(context: RequestContext): void {
  const timestamp = new Date('2026-03-01T00:00:00.000Z');

  context.state.accountingPeriods.push({
    id: 'period-open-vehicle-logs',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    year: 2026,
    month: 3,
    startDate: new Date('2026-03-01T00:00:00.000Z'),
    endDate: new Date('2026-04-01T00:00:00.000Z'),
    status: AccountingPeriodStatus.OPEN,
    openedAt: timestamp,
    lockedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

test('GET /vehicles returns only vehicles for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/vehicles', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'vehicle-1',
        name: '배송 밴',
        manufacturer: 'Hyundai',
        fuelType: 'DIESEL',
        initialOdometerKm: 58_200,
        estimatedFuelEfficiencyKmPerLiter: 11.2,
        defaultFundingAccountId: null,
        defaultFuelCategoryId: null,
        defaultMaintenanceCategoryId: null,
        operatingExpensePlanOptIn: false
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /vehicles/operating-summary returns the projected operating view for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.vehicles[0]!.fuelLogs.push({
      id: 'fuel-2',
      filledOn: new Date('2026-03-12T00:00:00.000Z'),
      odometerKm: 58_930,
      liters: 41.2,
      amountWon: 69_000,
      unitPriceWon: 1675,
      isFullTank: true
    });

    const response = await context.request('/vehicles/operating-summary', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      totals: {
        vehicleCount: 1,
        fuelExpenseWon: 141_000,
        maintenanceExpenseWon: 185_000,
        recordedOperatingExpenseWon: 326_000,
        averageEstimatedFuelEfficiencyKmPerLiter: 11.2,
        averageRecordedFuelEfficiencyKmPerLiter: 5.4
      },
      items: [
        {
          vehicleId: 'vehicle-1',
          vehicleName: '배송 밴',
          fuelType: 'DIESEL',
          fuelExpenseWon: 141_000,
          maintenanceExpenseWon: 185_000,
          recordedOperatingExpenseWon: 326_000,
          estimatedFuelEfficiencyKmPerLiter: 11.2,
          recordedFuelEfficiencyKmPerLiter: 5.4,
          fuelLogCount: 2,
          maintenanceLogCount: 1,
          lastFueledOn: '2026-03-12',
          lastMaintainedOn: '2026-03-18'
        }
      ]
    });
  } finally {
    await context.close();
  }
});

test('POST /vehicles creates a vehicle for the current workspace when the membership can manage vehicle data', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/vehicles', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: '영업용 승합차',
        manufacturer: 'Kia',
        fuelType: 'HYBRID',
        initialOdometerKm: 12_400,
        estimatedFuelEfficiencyKmPerLiter: 14.8,
        defaultFundingAccountId: 'acc-1',
        defaultFuelCategoryId: 'cat-1c',
        defaultMaintenanceCategoryId: 'cat-1c',
        operatingExpensePlanOptIn: true
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'vehicle-generated-3',
      name: '영업용 승합차',
      manufacturer: 'Kia',
      fuelType: 'HYBRID',
      initialOdometerKm: 12_400,
      estimatedFuelEfficiencyKmPerLiter: 14.8,
      defaultFundingAccountId: 'acc-1',
      defaultFuelCategoryId: 'cat-1c',
      defaultMaintenanceCategoryId: 'cat-1c',
      operatingExpensePlanOptIn: true
    });

    const createdVehicle = context.state.vehicles.find(
      (candidate) => candidate.id === 'vehicle-generated-3'
    );
    assert.ok(createdVehicle);
    assert.equal(createdVehicle.userId, 'user-1');
    assert.equal(createdVehicle.tenantId, 'tenant-1');
    assert.equal(createdVehicle.ledgerId, 'ledger-1');
    assert.equal(createdVehicle.name, '영업용 승합차');
    assert.equal(createdVehicle.manufacturer, 'Kia');
    assert.equal(createdVehicle.fuelType, 'HYBRID');
    assert.equal(createdVehicle.initialOdometerKm, 12_400);
    assert.equal(createdVehicle.estimatedFuelEfficiencyKmPerLiter, 14.8);
    assert.equal(createdVehicle.defaultFundingAccountId, 'acc-1');
    assert.equal(createdVehicle.defaultFuelCategoryId, 'cat-1c');
    assert.equal(createdVehicle.defaultMaintenanceCategoryId, 'cat-1c');
    assert.equal(createdVehicle.operatingExpensePlanOptIn, true);
    assert.equal(createdVehicle.fuelLogs.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /vehicles returns 403 when the current membership cannot create vehicles', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request('/vehicles', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: '영업용 승합차',
        fuelType: 'HYBRID',
        initialOdometerKm: 12_400
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('PATCH /vehicles/:id updates vehicle basic information for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/vehicles/vehicle-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: '배송 밴 플러스',
        manufacturer: 'Hyundai',
        fuelType: 'DIESEL',
        initialOdometerKm: 58_500,
        estimatedFuelEfficiencyKmPerLiter: 12.1
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'vehicle-1',
      name: '배송 밴 플러스',
      manufacturer: 'Hyundai',
      fuelType: 'DIESEL',
      initialOdometerKm: 58_500,
      estimatedFuelEfficiencyKmPerLiter: 12.1,
      defaultFundingAccountId: null,
      defaultFuelCategoryId: null,
      defaultMaintenanceCategoryId: null,
      operatingExpensePlanOptIn: false
    });

    const updatedVehicle = context.state.vehicles.find(
      (candidate) => candidate.id === 'vehicle-1'
    );
    assert.ok(updatedVehicle);
    assert.equal(updatedVehicle.name, '배송 밴 플러스');
    assert.equal(updatedVehicle.manufacturer, 'Hyundai');
    assert.equal(updatedVehicle.fuelType, 'DIESEL');
    assert.equal(updatedVehicle.initialOdometerKm, 58_500);
    assert.equal(updatedVehicle.estimatedFuelEfficiencyKmPerLiter, 12.1);
    assert.equal(updatedVehicle.defaultFundingAccountId, null);
    assert.equal(updatedVehicle.defaultFuelCategoryId, null);
    assert.equal(updatedVehicle.defaultMaintenanceCategoryId, null);
    assert.equal(updatedVehicle.operatingExpensePlanOptIn, false);
    assert.equal(updatedVehicle.fuelLogs.length, 1);
  } finally {
    await context.close();
  }
});

test('PATCH /vehicles/:id returns 403 when the current membership cannot update vehicles', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/vehicles/vehicle-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: '배송 밴 플러스',
        manufacturer: 'Hyundai',
        fuelType: 'DIESEL',
        initialOdometerKm: 58_500,
        estimatedFuelEfficiencyKmPerLiter: 12.1
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('GET /vehicles/fuel-logs returns only fuel logs for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.vehicles[1]!.fuelLogs.push({
      id: 'fuel-2',
      filledOn: new Date('2026-03-21T00:00:00.000Z'),
      odometerKm: 12_640,
      liters: 31.4,
      amountWon: 58_000,
      unitPriceWon: 1847,
      isFullTank: false
    });

    const response = await context.request('/vehicles/fuel-logs', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'fuel-1',
        vehicleId: 'vehicle-1',
        vehicleName: '배송 밴',
        filledOn: '2026-03-05',
        odometerKm: 58_480,
        liters: 42.5,
        amountWon: 72_000,
        unitPriceWon: 1694,
        isFullTank: true,
        linkedCollectedTransaction: null
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /vehicles/:id/fuel-logs creates a fuel log for the current workspace vehicle', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/vehicles/vehicle-1/fuel-logs', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        filledOn: '2026-03-25',
        odometerKm: 58_940,
        liters: 39.8,
        amountWon: 70_200,
        unitPriceWon: 1764,
        isFullTank: true
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'fuel-generated-2',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴',
      filledOn: '2026-03-25',
      odometerKm: 58_940,
      liters: 39.8,
      amountWon: 70_200,
      unitPriceWon: 1764,
      isFullTank: true,
      linkedCollectedTransaction: null
    });

    assert.deepEqual(
      context.state.vehicles
        .find((candidate) => candidate.id === 'vehicle-1')
        ?.fuelLogs.at(-1),
      {
        id: 'fuel-generated-2',
        linkedCollectedTransactionId: null,
        filledOn: new Date('2026-03-25T00:00:00.000Z'),
        odometerKm: 58_940,
        liters: 39.8,
        amountWon: 70_200,
        unitPriceWon: 1764,
        isFullTank: true
      }
    );
  } finally {
    await context.close();
  }
});

test('PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId updates a fuel log for the current workspace vehicle', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request(
      '/vehicles/vehicle-1/fuel-logs/fuel-1',
      {
        method: 'PATCH',
        headers: context.authHeaders(),
        body: {
          filledOn: '2026-03-06',
          odometerKm: 58_520,
          liters: 43.1,
          amountWon: 73_400,
          unitPriceWon: 1703,
          isFullTank: false
        }
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'fuel-1',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴',
      filledOn: '2026-03-06',
      odometerKm: 58_520,
      liters: 43.1,
      amountWon: 73_400,
      unitPriceWon: 1703,
      isFullTank: false,
      linkedCollectedTransaction: null
    });

    const updatedFuelLog = context.state.vehicles
      .find((candidate) => candidate.id === 'vehicle-1')
      ?.fuelLogs.find((candidate) => candidate.id === 'fuel-1');
    assert.ok(updatedFuelLog);
    assert.equal(
      updatedFuelLog.filledOn.toISOString(),
      '2026-03-06T00:00:00.000Z'
    );
    assert.equal(updatedFuelLog.odometerKm, 58_520);
    assert.equal(updatedFuelLog.liters, 43.1);
    assert.equal(updatedFuelLog.amountWon, 73_400);
    assert.equal(updatedFuelLog.unitPriceWon, 1703);
    assert.equal(updatedFuelLog.isFullTank, false);
  } finally {
    await context.close();
  }
});

test('POST /vehicles/:id/fuel-logs can create a linked collected transaction when accountingLink is provided', async () => {
  const context = await createRequestTestContext();
  const initialCollectedCount = context.state.collectedTransactions.length;

  try {
    addOpenMarchVehicleAccountingPeriod(context);

    const response = await context.request('/vehicles/vehicle-1/fuel-logs', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        filledOn: '2026-03-26',
        odometerKm: 58_980,
        liters: 42.1,
        amountWon: 73_000,
        unitPriceWon: 1734,
        isFullTank: true,
        accountingLink: {
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1c'
        }
      }
    });

    assert.equal(response.status, 201);
    assert.equal(
      context.state.collectedTransactions.length,
      initialCollectedCount + 1
    );

    const linkedTransaction = context.state.collectedTransactions.at(-1);
    assert.ok(linkedTransaction);
    assert.deepEqual(response.body, {
      id: 'fuel-generated-2',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴',
      filledOn: '2026-03-26',
      odometerKm: 58_980,
      liters: 42.1,
      amountWon: 73_000,
      unitPriceWon: 1734,
      isFullTank: true,
      linkedCollectedTransaction: {
        id: linkedTransaction.id,
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1c',
        postingStatus: 'READY_TO_POST',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null
      }
    });

    assert.equal(linkedTransaction.title, '배송 밴 연료비');
    assert.equal(linkedTransaction.fundingAccountId, 'acc-1');
    assert.equal(linkedTransaction.categoryId, 'cat-1c');
    assert.equal(linkedTransaction.status, 'READY_TO_POST');
    assert.equal(linkedTransaction.periodId !== null, true);
    assert.match(linkedTransaction.memo ?? '', /42\.1L/);

    const createdFuelLog = context.state.vehicles
      .find((candidate) => candidate.id === 'vehicle-1')
      ?.fuelLogs.at(-1);
    assert.equal(
      createdFuelLog?.linkedCollectedTransactionId,
      linkedTransaction.id
    );

    const transactionsResponse = await context.request(
      '/collected-transactions',
      {
        headers: context.authHeaders()
      }
    );
    const transactionItem = (
      transactionsResponse.body as Array<{
        id: string;
        sourceKind: string;
        sourceVehicleLog?: unknown;
      }>
    ).find((item) => item.id === linkedTransaction.id);
    assert.ok(transactionItem);
    assert.equal(transactionItem.sourceKind, 'VEHICLE_LOG');
    assert.deepEqual(transactionItem.sourceVehicleLog, {
      kind: 'FUEL',
      logId: 'fuel-generated-2',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴'
    });
  } finally {
    await context.close();
  }
});

test('PATCH /collected-transactions/:id rejects direct updates for vehicle-linked collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    addOpenMarchVehicleAccountingPeriod(context);

    const createResponse = await context.request(
      '/vehicles/vehicle-1/fuel-logs',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          filledOn: '2026-03-26',
          odometerKm: 58_980,
          liters: 42.1,
          amountWon: 73_000,
          unitPriceWon: 1734,
          isFullTank: true,
          accountingLink: {
            fundingAccountId: 'acc-1',
            categoryId: 'cat-1c'
          }
        }
      }
    );

    assert.equal(createResponse.status, 201);
    const linkedTransactionId = (
      createResponse.body as {
        linkedCollectedTransaction: { id: string };
      }
    ).linkedCollectedTransaction.id;

    const response = await context.request(
      `/collected-transactions/${linkedTransactionId}`,
      {
        method: 'PATCH',
        headers: context.authHeaders(),
        body: {
          title: '직접 수정 시도',
          type: 'EXPENSE',
          amountWon: 75_000,
          businessDate: '2026-03-26',
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1c'
        }
      }
    );

    assert.equal(response.status, 400);
    assert.equal(
      (response.body as { message?: string }).message,
      '차량 연료/정비 기록에서 생성된 수집거래는 차량 운영 화면에서만 수정하거나 연결 해제할 수 있습니다.'
    );
  } finally {
    await context.close();
  }
});

test('PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId rejects updates when the linked collected transaction is already posted', async () => {
  const context = await createRequestTestContext();

  try {
    addOpenMarchVehicleAccountingPeriod(context);

    context.state.collectedTransactions.push({
      id: 'ctx-vehicle-posted-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: context.state.collectedTransactions[0]?.periodId ?? null,
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1c',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: null,
      title: '배송 밴 연료비',
      occurredOn: new Date('2026-03-05T00:00:00.000Z'),
      amount: 72_000,
      status: CollectedTransactionStatus.POSTED,
      memo: '기확정 연료비',
      createdAt: new Date('2026-03-05T09:00:00.000Z'),
      updatedAt: new Date('2026-03-05T09:00:00.000Z')
    });
    context.state.vehicles[0]!.fuelLogs[0]!.linkedCollectedTransactionId =
      'ctx-vehicle-posted-1';

    const response = await context.request(
      '/vehicles/vehicle-1/fuel-logs/fuel-1',
      {
        method: 'PATCH',
        headers: context.authHeaders(),
        body: {
          filledOn: '2026-03-06',
          odometerKm: 58_520,
          liters: 43.1,
          amountWon: 73_400,
          unitPriceWon: 1703,
          isFullTank: false,
          accountingLink: {
            fundingAccountId: 'acc-1',
            categoryId: 'cat-1c'
          }
        }
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message?: string }).message,
      'Only unposted collected transactions can be updated.'
    );
  } finally {
    await context.close();
  }
});

test('DELETE /vehicles/:vehicleId/fuel-logs/:fuelLogId removes an unlinked fuel log', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request(
      '/vehicles/vehicle-1/fuel-logs/fuel-1',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 204);
    assert.equal(
      context.state.vehicles[0]?.fuelLogs.some(
        (candidate) => candidate.id === 'fuel-1'
      ),
      false
    );
  } finally {
    await context.close();
  }
});

test('DELETE /vehicles/:vehicleId/fuel-logs/:fuelLogId removes a linked unposted fuel collected transaction in the same operation', async () => {
  const context = await createRequestTestContext();

  try {
    addOpenMarchVehicleAccountingPeriod(context);

    const createResponse = await context.request(
      '/vehicles/vehicle-1/fuel-logs',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          filledOn: '2026-03-26',
          odometerKm: 58_980,
          liters: 42.1,
          amountWon: 73_000,
          unitPriceWon: 1734,
          isFullTank: true,
          accountingLink: {
            fundingAccountId: 'acc-1',
            categoryId: 'cat-1c'
          }
        }
      }
    );

    assert.equal(createResponse.status, 201);
    const createdFuelLog = createResponse.body as {
      id: string;
      linkedCollectedTransaction: { id: string };
    };
    const linkedTransactionId = createdFuelLog.linkedCollectedTransaction.id;

    const response = await context.request(
      `/vehicles/vehicle-1/fuel-logs/${createdFuelLog.id}`,
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 204);
    assert.equal(
      context.state.vehicles[0]?.fuelLogs.some(
        (candidate) => candidate.id === createdFuelLog.id
      ),
      false
    );
    assert.equal(
      context.state.collectedTransactions.some(
        (candidate) => candidate.id === linkedTransactionId
      ),
      false
    );
  } finally {
    await context.close();
  }
});

test('DELETE /vehicles/:vehicleId/fuel-logs/:fuelLogId rejects deletion when the linked collected transaction is posted', async () => {
  const context = await createRequestTestContext();

  try {
    addOpenMarchVehicleAccountingPeriod(context);

    context.state.collectedTransactions.push({
      id: 'ctx-vehicle-posted-delete-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: context.state.accountingPeriods[0]?.id ?? null,
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1c',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: null,
      title: '배송 밴 연료비',
      occurredOn: new Date('2026-03-05T00:00:00.000Z'),
      amount: 72_000,
      status: CollectedTransactionStatus.POSTED,
      memo: '기확정 연료비',
      createdAt: new Date('2026-03-05T09:00:00.000Z'),
      updatedAt: new Date('2026-03-05T09:00:00.000Z')
    });
    context.state.vehicles[0]!.fuelLogs[0]!.linkedCollectedTransactionId =
      'ctx-vehicle-posted-delete-1';

    const response = await context.request(
      '/vehicles/vehicle-1/fuel-logs/fuel-1',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message?: string }).message,
      'Only unposted collected transactions can be deleted.'
    );
    assert.equal(
      context.state.vehicles[0]?.fuelLogs.some(
        (candidate) => candidate.id === 'fuel-1'
      ),
      true
    );
    assert.equal(
      context.state.collectedTransactions.some(
        (candidate) => candidate.id === 'ctx-vehicle-posted-delete-1'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('POST /vehicles/:id/fuel-logs returns 403 when the current membership cannot create fuel logs', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request('/vehicles/vehicle-1/fuel-logs', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        filledOn: '2026-03-25',
        odometerKm: 58_940,
        liters: 39.8,
        amountWon: 70_200,
        unitPriceWon: 1764,
        isFullTank: true
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('GET /vehicles/maintenance-logs returns only maintenance logs for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.vehicleMaintenanceLogs.push({
      id: 'maintenance-2',
      vehicleId: 'vehicle-2',
      performedOn: new Date('2026-03-21T00:00:00.000Z'),
      odometerKm: 12_640,
      category: 'INSPECTION',
      vendor: '기타 정비소',
      description: '엔진오일 점검',
      amountWon: 45_000,
      memo: null,
      createdAt: new Date('2026-03-21T09:00:00.000Z'),
      updatedAt: new Date('2026-03-21T09:00:00.000Z')
    });

    const response = await context.request('/vehicles/maintenance-logs', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'maintenance-1',
        vehicleId: 'vehicle-1',
        vehicleName: '배송 밴',
        performedOn: '2026-03-18',
        odometerKm: 58_620,
        category: 'REPAIR',
        vendor: '현대 블루핸즈',
        description: '브레이크 패드 교체',
        amountWon: 185_000,
        memo: '전륜 패드 기준',
        linkedCollectedTransaction: null
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /vehicles/:id/maintenance-logs creates a maintenance log for the current workspace vehicle', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          performedOn: '2026-03-25',
          odometerKm: 58_940,
          category: 'CONSUMABLE',
          vendor: '타이어프로',
          description: '앞 타이어 2본 교체',
          amountWon: 240_000,
          memo: '얼라인먼트 포함'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'maintenance-generated-2',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴',
      performedOn: '2026-03-25',
      odometerKm: 58_940,
      category: 'CONSUMABLE',
      vendor: '타이어프로',
      description: '앞 타이어 2본 교체',
      amountWon: 240_000,
      memo: '얼라인먼트 포함',
      linkedCollectedTransaction: null
    });

    assert.deepEqual(
      context.state.vehicleMaintenanceLogs.find(
        (candidate) => candidate.id === 'maintenance-generated-2'
      ),
      {
        id: 'maintenance-generated-2',
        vehicleId: 'vehicle-1',
        linkedCollectedTransactionId: null,
        performedOn: new Date('2026-03-25T00:00:00.000Z'),
        odometerKm: 58_940,
        category: 'CONSUMABLE',
        vendor: '타이어프로',
        description: '앞 타이어 2본 교체',
        amountWon: 240_000,
        memo: '얼라인먼트 포함',
        createdAt: context.state.vehicleMaintenanceLogs.find(
          (candidate) => candidate.id === 'maintenance-generated-2'
        )?.createdAt,
        updatedAt: context.state.vehicleMaintenanceLogs.find(
          (candidate) => candidate.id === 'maintenance-generated-2'
        )?.updatedAt
      }
    );
  } finally {
    await context.close();
  }
});

test('POST /vehicles/:id/maintenance-logs can create a linked collected transaction when accountingLink is provided', async () => {
  const context = await createRequestTestContext();

  try {
    addOpenMarchVehicleAccountingPeriod(context);

    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          performedOn: '2026-03-27',
          odometerKm: 59_040,
          category: 'REPAIR',
          vendor: '현대 블루핸즈',
          description: '에어컨 필터 교체',
          amountWon: 57_000,
          memo: '봄철 정비',
          accountingLink: {
            fundingAccountId: 'acc-1',
            categoryId: 'cat-1c'
          }
        }
      }
    );

    assert.equal(response.status, 201);

    const linkedTransaction = context.state.collectedTransactions.at(-1);
    assert.ok(linkedTransaction);
    assert.deepEqual(response.body, {
      id: 'maintenance-generated-2',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴',
      performedOn: '2026-03-27',
      odometerKm: 59_040,
      category: 'REPAIR',
      vendor: '현대 블루핸즈',
      description: '에어컨 필터 교체',
      amountWon: 57_000,
      memo: '봄철 정비',
      linkedCollectedTransaction: {
        id: linkedTransaction.id,
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1c',
        postingStatus: 'READY_TO_POST',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null
      }
    });

    assert.equal(
      context.state.vehicleMaintenanceLogs.at(-1)?.linkedCollectedTransactionId,
      linkedTransaction.id
    );
    assert.match(linkedTransaction.title, /배송 밴 정비비/u);
    assert.match(linkedTransaction.memo ?? '', /에어컨 필터 교체/u);
  } finally {
    await context.close();
  }
});

test('PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId updates a maintenance log for the current workspace vehicle', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs/maintenance-1',
      {
        method: 'PATCH',
        headers: context.authHeaders(),
        body: {
          performedOn: '2026-03-19',
          odometerKm: 58_700,
          category: 'REPAIR',
          vendor: '현대 블루핸즈 강남점',
          description: '브레이크 패드 및 디스크 점검',
          amountWon: 198_000,
          memo: '후속 정비 예약'
        }
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'maintenance-1',
      vehicleId: 'vehicle-1',
      vehicleName: '배송 밴',
      performedOn: '2026-03-19',
      odometerKm: 58_700,
      category: 'REPAIR',
      vendor: '현대 블루핸즈 강남점',
      description: '브레이크 패드 및 디스크 점검',
      amountWon: 198_000,
      memo: '후속 정비 예약',
      linkedCollectedTransaction: null
    });

    const updatedLog = context.state.vehicleMaintenanceLogs.find(
      (candidate) => candidate.id === 'maintenance-1'
    );
    assert.ok(updatedLog);
    assert.equal(
      updatedLog.performedOn.toISOString(),
      '2026-03-19T00:00:00.000Z'
    );
    assert.equal(updatedLog.odometerKm, 58_700);
    assert.equal(updatedLog.category, 'REPAIR');
    assert.equal(updatedLog.vendor, '현대 블루핸즈 강남점');
    assert.equal(updatedLog.description, '브레이크 패드 및 디스크 점검');
    assert.equal(updatedLog.amountWon, 198_000);
    assert.equal(updatedLog.memo, '후속 정비 예약');
  } finally {
    await context.close();
  }
});

test('POST /vehicles/:id/maintenance-logs returns 403 when the current membership cannot create maintenance logs', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          performedOn: '2026-03-25',
          odometerKm: 58_940,
          category: 'CONSUMABLE',
          description: '앞 타이어 2본 교체',
          amountWon: 240_000
        }
      }
    );

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});

test('DELETE /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId removes an unlinked maintenance log', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs/maintenance-1',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 204);
    assert.equal(
      context.state.vehicleMaintenanceLogs.some(
        (candidate) => candidate.id === 'maintenance-1'
      ),
      false
    );
  } finally {
    await context.close();
  }
});

test('DELETE /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId removes a linked unposted maintenance collected transaction in the same operation', async () => {
  const context = await createRequestTestContext();

  try {
    addOpenMarchVehicleAccountingPeriod(context);

    const createResponse = await context.request(
      '/vehicles/vehicle-1/maintenance-logs',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          performedOn: '2026-03-27',
          odometerKm: 59_040,
          category: 'REPAIR',
          vendor: '현대 블루핸즈',
          description: '에어컨 필터 교체',
          amountWon: 57_000,
          memo: '봄철 정비',
          accountingLink: {
            fundingAccountId: 'acc-1',
            categoryId: 'cat-1c'
          }
        }
      }
    );

    assert.equal(createResponse.status, 201);
    const createdMaintenanceLog = createResponse.body as {
      id: string;
      linkedCollectedTransaction: { id: string };
    };
    const linkedTransactionId =
      createdMaintenanceLog.linkedCollectedTransaction.id;

    const response = await context.request(
      `/vehicles/vehicle-1/maintenance-logs/${createdMaintenanceLog.id}`,
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 204);
    assert.equal(
      context.state.vehicleMaintenanceLogs.some(
        (candidate) => candidate.id === createdMaintenanceLog.id
      ),
      false
    );
    assert.equal(
      context.state.collectedTransactions.some(
        (candidate) => candidate.id === linkedTransactionId
      ),
      false
    );
  } finally {
    await context.close();
  }
});

test('DELETE /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId rejects deletion when the linked collected transaction is posted', async () => {
  const context = await createRequestTestContext();

  try {
    addOpenMarchVehicleAccountingPeriod(context);

    context.state.collectedTransactions.push({
      id: 'ctx-vehicle-maintenance-posted-delete-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: context.state.accountingPeriods[0]?.id ?? null,
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1c',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: null,
      title: '배송 밴 정비비',
      occurredOn: new Date('2026-03-18T00:00:00.000Z'),
      amount: 185_000,
      status: CollectedTransactionStatus.POSTED,
      memo: '기확정 정비비',
      createdAt: new Date('2026-03-18T09:00:00.000Z'),
      updatedAt: new Date('2026-03-18T09:00:00.000Z')
    });
    context.state.vehicleMaintenanceLogs[0]!.linkedCollectedTransactionId =
      'ctx-vehicle-maintenance-posted-delete-1';

    const response = await context.request(
      '/vehicles/vehicle-1/maintenance-logs/maintenance-1',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message?: string }).message,
      'Only unposted collected transactions can be deleted.'
    );
    assert.equal(
      context.state.vehicleMaintenanceLogs.some(
        (candidate) => candidate.id === 'maintenance-1'
      ),
      true
    );
    assert.equal(
      context.state.collectedTransactions.some(
        (candidate) =>
          candidate.id === 'ctx-vehicle-maintenance-posted-delete-1'
      ),
      true
    );
  } finally {
    await context.close();
  }
});
