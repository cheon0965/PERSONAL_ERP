import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectedTransactionStatus } from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import { addOpenMarchVehicleAccountingPeriod } from './fixtures';

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
