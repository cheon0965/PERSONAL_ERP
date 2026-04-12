import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from './request-api.test-support';

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
        estimatedFuelEfficiencyKmPerLiter: 11.2
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
        estimatedFuelEfficiencyKmPerLiter: 14.8
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'vehicle-generated-3',
      name: '영업용 승합차',
      manufacturer: 'Kia',
      fuelType: 'HYBRID',
      initialOdometerKm: 12_400,
      estimatedFuelEfficiencyKmPerLiter: 14.8
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
      estimatedFuelEfficiencyKmPerLiter: 12.1
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
        isFullTank: true
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
      isFullTank: true
    });

    assert.deepEqual(
      context.state.vehicles
        .find((candidate) => candidate.id === 'vehicle-1')
        ?.fuelLogs.at(-1),
      {
        id: 'fuel-generated-2',
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
      isFullTank: false
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
        memo: '전륜 패드 기준'
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
      memo: '얼라인먼트 포함'
    });

    assert.deepEqual(
      context.state.vehicleMaintenanceLogs.find(
        (candidate) => candidate.id === 'maintenance-generated-2'
      ),
      {
        id: 'maintenance-generated-2',
        vehicleId: 'vehicle-1',
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
      memo: '후속 정비 예약'
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
