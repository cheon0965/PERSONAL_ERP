import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CollectedTransactionStatus,
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  PlanItemStatus,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  buildImportRowFingerprint,
  pushCollectedTransaction,
  pushImportBatch,
  pushImportedRow,
  seedCollectableImportScenario
} from './shared';

test('POST /import-batches/:id/rows/:rowId/collect returns 400 for a failed imported row', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-failed-row',
      sourceKind: ImportSourceKind.BANK_CSV,
      fileName: 'failed-row.csv',
      fileHash: 'hash-failed-row',
      parseStatus: ImportBatchParseStatus.FAILED
    });
    pushImportedRow(context, {
      id: 'imported-row-failed-1',
      batchId: 'import-batch-failed-row',
      title: 'Broken row',
      amount: 12_000,
      parseStatus: ImportedRowParseStatus.FAILED
    });

    const response = await context.request(
      '/import-batches/import-batch-failed-row/rows/imported-row-failed-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message: '파싱 완료 행만 수집 거래로 승격할 수 있습니다.',
      error: 'Bad Request'
    });
    assert.equal(context.state.collectedTransactions.length, 3);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 400 for a locked target month', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-locked-period',
      fileName: 'locked-period.csv',
      fileHash: 'hash-locked-period'
    });
    pushImportedRow(context, {
      id: 'imported-row-locked-period',
      batchId: 'import-batch-locked-period',
      occurredOn: '2026-02-12',
      title: 'Locked month row',
      amount: 14_000
    });
    context.state.accountingPeriods.push({
      id: 'period-locked-2026-02',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      status: 'LOCKED',
      nextJournalEntrySequence: 1,
      openedAt: new Date('2026-02-01T00:00:00.000Z'),
      lockedAt: new Date('2026-02-28T23:59:59.000Z'),
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-28T23:59:59.000Z')
    });

    const response = await context.request(
      '/import-batches/import-batch-locked-period/rows/imported-row-locked-period/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message: '2026-02 마감월 데이터이기 때문에 저장할 수 없습니다.',
      error: 'Bad Request'
    });
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect requires confirmation when a potential duplicate transaction exists', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      title: 'Fuel refill',
      amount: 84_000
    });
    pushCollectedTransaction(context, {
      id: 'ctx-potential-duplicate-collect',
      periodId: 'period-open-import-collect',
      title: 'Fuel refill existing',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 84_000
    });

    const blockedResponse = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(blockedResponse.status, 409);
    assert.deepEqual(blockedResponse.body, {
      statusCode: 409,
      message:
        '같은 거래일·금액·입출금 유형의 기존 거래 1건이 있어 확인 없이 저장할 수 없습니다. 자동 판정 요약을 확인한 뒤 다시 등록해 주세요.',
      error: 'Conflict'
    });
    assert.equal(context.state.collectedTransactions.length, 4);

    const confirmedResponse = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1',
          confirmPotentialDuplicate: true
        }
      }
    );

    assert.equal(confirmedResponse.status, 201);
    assert.equal(context.state.collectedTransactions.length, 5);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect ignores duplicate candidates from the same import batch', async () => {
  const context = await createRequestTestContext();

  try {
    const duplicateFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-12',
      amount: 84_000,
      title: 'Fuel refill'
    });

    seedCollectableImportScenario(context, {
      title: 'Fuel refill',
      amount: 84_000,
      sourceFingerprint: duplicateFingerprint
    });
    pushCollectedTransaction(context, {
      id: 'ctx-same-batch-potential-duplicate-collect',
      periodId: 'period-open-import-collect',
      importBatchId: 'import-batch-collect',
      importedRowId: 'imported-row-same-batch-existing',
      sourceFingerprint: duplicateFingerprint,
      title: 'Fuel refill existing from same batch',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 84_000
    });

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(
      (
        response.body as {
          preview: {
            autoPreparation: {
              hasDuplicateSourceFingerprint: boolean;
              potentialDuplicateTransactionCount?: number;
            };
          };
        }
      ).preview.autoPreparation.hasDuplicateSourceFingerprint,
      false
    );
    assert.equal(
      (
        response.body as {
          preview: {
            autoPreparation: {
              potentialDuplicateTransactionCount?: number;
            };
          };
        }
      ).preview.autoPreparation.potentialDuplicateTransactionCount,
      undefined
    );
    assert.equal(
      context.state.collectedTransactions.at(-1)?.status,
      CollectedTransactionStatus.READY_TO_POST
    );
    assert.equal(
      context.state.collectedTransactions.at(-1)?.matchedPlanItemId,
      'plan-item-collect-1'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect still requires confirmation for duplicate candidates from another import batch', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      title: 'Fuel refill',
      amount: 84_000
    });
    pushCollectedTransaction(context, {
      id: 'ctx-other-batch-potential-duplicate-collect',
      periodId: 'period-open-import-collect',
      importBatchId: 'import-batch-earlier-upload',
      importedRowId: 'imported-row-earlier-upload',
      title: 'Fuel refill from earlier upload',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 84_000
    });

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message: string }).message,
      '같은 거래일·금액·입출금 유형의 기존 거래 1건이 있어 확인 없이 저장할 수 없습니다. 자동 판정 요약을 확인한 뒤 다시 등록해 주세요.'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect keeps the transaction in collected status when a duplicate fingerprint already exists', async () => {
  const context = await createRequestTestContext();

  try {
    const duplicateFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-12',
      amount: 12_000,
      title: 'Lunch'
    });

    seedCollectableImportScenario(context, {
      periodId: 'period-open-duplicate-fingerprint',
      batchId: 'import-batch-duplicate-fingerprint',
      rowId: 'imported-row-duplicate-fingerprint',
      planItemId: 'plan-item-duplicate-fingerprint',
      title: 'Lunch',
      amount: 12_000,
      fileName: 'duplicate-fingerprint.csv',
      fileHash: 'hash-duplicate-fingerprint',
      planItemTitle: 'Lunch budget',
      sourceFingerprint: duplicateFingerprint
    });
    pushCollectedTransaction(context, {
      id: 'ctx-existing-duplicate-fingerprint',
      periodId: 'period-open-duplicate-fingerprint',
      sourceFingerprint: duplicateFingerprint,
      title: 'Existing lunch'
    });

    const response = await context.request(
      '/import-batches/import-batch-duplicate-fingerprint/rows/imported-row-duplicate-fingerprint/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          confirmPotentialDuplicate: true
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(
      context.state.collectedTransactions.at(-1)?.status,
      CollectedTransactionStatus.COLLECTED
    );
    assert.equal(
      context.state.collectedTransactions.at(-1)?.matchedPlanItemId,
      null
    );
    assert.equal(
      context.state.collectedTransactions.at(-1)?.categoryId,
      'cat-1'
    );
    assert.equal(
      context.state.planItems.find(
        (candidate) => candidate.id === 'plan-item-duplicate-fingerprint'
      )?.status,
      PlanItemStatus.DRAFT
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 409 when the imported row is already promoted', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      periodId: 'period-open-duplicate-collect',
      batchId: 'import-batch-duplicate-collect',
      rowId: 'imported-row-duplicate-1',
      title: 'Lunch',
      amount: 12_000,
      sourceFingerprint: 'sf:v1:duplicate',
      fileName: 'duplicate-collect.csv',
      fileHash: 'hash-duplicate-collect'
    });
    pushCollectedTransaction(context, {
      id: 'ctx-imported-existing',
      periodId: 'period-open-duplicate-collect',
      importBatchId: 'import-batch-duplicate-collect',
      importedRowId: 'imported-row-duplicate-1',
      sourceFingerprint: 'sf:v1:duplicate',
      title: 'Lunch',
      status: CollectedTransactionStatus.COLLECTED
    });

    const response = await context.request(
      '/import-batches/import-batch-duplicate-collect/rows/imported-row-duplicate-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message: '이미 수집 거래로 승격된 업로드 행입니다.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.collectedTransactions.filter(
        (candidate) => candidate.importedRowId === 'imported-row-duplicate-1'
      ).length,
      1
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 403 when the current membership role cannot create collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';
    pushImportBatch(context, {
      id: 'import-batch-denied-collect',
      fileName: 'denied-collect.csv',
      fileHash: 'hash-denied-collect'
    });
    pushImportedRow(context, {
      id: 'imported-row-denied-1',
      batchId: 'import-batch-denied-collect',
      title: 'Coffee',
      amount: 4_800,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 4_800,
        title: 'Coffee'
      })
    });

    const response = await context.request(
      '/import-batches/import-batch-denied-collect/rows/imported-row-denied-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 403);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.importBatchId === 'import-batch-denied-collect' &&
          candidate.details.importedRowId === 'imported-row-denied-1' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});
