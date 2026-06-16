import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectedTransactionStatus } from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import { addOpenMarchVehicleAccountingPeriod } from './fixtures';

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
