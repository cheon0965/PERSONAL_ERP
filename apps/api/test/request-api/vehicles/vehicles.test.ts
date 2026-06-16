import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from '../../support/request-api/index';

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
