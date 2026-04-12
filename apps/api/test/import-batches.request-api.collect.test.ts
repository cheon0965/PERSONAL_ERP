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
import { createRequestTestContext } from './request-api.test-support';
import {
  buildImportRowFingerprint,
  pushCollectedTransaction,
  pushImportBatch,
  pushImportedRow,
  seedCollectableImportScenario
} from './import-batches.request-api.shared';

test('POST /import-batches/:id/rows/:rowId/collect creates a collected transaction from a parsed imported row', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context);

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Imported from upload'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      collectedTransaction: {
        id: 'ctx-4',
        businessDate: '2026-03-12',
        title: 'Coffee beans',
        type: TransactionType.EXPENSE,
        amountWon: 19_800,
        fundingAccountName: 'Main checking',
        categoryName: 'Fuel',
        sourceKind: 'IMPORT',
        postingStatus: 'READY_TO_POST',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null,
        matchedPlanItemId: 'plan-item-collect-1',
        matchedPlanItemTitle: 'Coffee beans budget'
      },
      preview: {
        importedRowId: 'imported-row-collect-1',
        occurredOn: '2026-03-12',
        title: 'Coffee beans',
        amountWon: 19_800,
        fundingAccountId: 'acc-1',
        fundingAccountName: 'Main checking',
        type: TransactionType.EXPENSE,
        requestedCategoryId: null,
        requestedCategoryName: null,
        autoPreparation: {
          matchedPlanItemId: 'plan-item-collect-1',
          matchedPlanItemTitle: 'Coffee beans budget',
          effectiveCategoryId: 'cat-1',
          effectiveCategoryName: 'Fuel',
          nextWorkflowStatus: 'READY_TO_POST',
          hasDuplicateSourceFingerprint: false,
          allowPlanItemMatch: true,
          decisionReasons: [
            '계획 항목 "Coffee beans budget"과 연결합니다.',
            '계획 항목 기준으로 "Fuel" 카테고리를 보완합니다.',
            '즉시 전표 준비 상태로 올립니다.'
          ]
        }
      }
    });
    assert.equal(context.state.collectedTransactions.length, 4);
    assert.deepEqual(context.state.collectedTransactions.at(-1), {
      id: 'ctx-4',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-import-collect',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: 'plan-item-collect-1',
      importBatchId: 'import-batch-collect',
      importedRowId: 'imported-row-collect-1',
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 19_800,
        title: 'Coffee beans'
      }),
      title: 'Coffee beans',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 19_800,
      status: CollectedTransactionStatus.READY_TO_POST,
      memo: 'Imported from upload',
      createdAt: context.state.collectedTransactions.at(-1)?.createdAt,
      updatedAt: context.state.collectedTransactions.at(-1)?.updatedAt
    });
    assert.equal(
      context.state.planItems.find(
        (candidate) => candidate.id === 'plan-item-collect-1'
      )?.status,
      PlanItemStatus.MATCHED
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.importBatchId === 'import-batch-collect' &&
          candidate.details.importedRowId === 'imported-row-collect-1' &&
          candidate.details.collectedTransactionId === 'ctx-4'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect absorbs a recurring collected transaction that was already created from a matched plan item', async () => {
  const context = await createRequestTestContext();

  try {
    const seeded = seedCollectableImportScenario(context, {
      periodId: 'period-open-recurring-absorb',
      batchId: 'import-batch-recurring-absorb',
      rowId: 'imported-row-recurring-absorb',
      planItemId: 'plan-item-recurring-absorb',
      title: 'Phone bill',
      amount: 75_000,
      planItemTitle: 'Phone bill'
    });

    context.state.planItems = context.state.planItems.map((candidate) =>
      candidate.id === seeded.planItem.id
        ? {
            ...candidate,
            status: PlanItemStatus.MATCHED,
            updatedAt: new Date()
          }
        : candidate
    );

    pushCollectedTransaction(context, {
      id: 'ctx-recurring-existing',
      periodId: seeded.period.id,
      matchedPlanItemId: seeded.planItem.id,
      title: 'Phone bill',
      amount: 75_000,
      occurredOn: new Date('2026-03-11T00:00:00.000Z'),
      status: CollectedTransactionStatus.READY_TO_POST
    });

    const response = await context.request(
      '/import-batches/import-batch-recurring-absorb/rows/imported-row-recurring-absorb/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Imported recurring bill'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(
      (response.body as { collectedTransaction: { id: string } })
        .collectedTransaction.id,
      'ctx-recurring-existing'
    );
    assert.equal(
      context.state.collectedTransactions.filter(
        (candidate) => candidate.matchedPlanItemId === seeded.planItem.id
      ).length,
      1
    );
    assert.deepEqual(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-recurring-existing'
      ),
      {
        id: 'ctx-recurring-existing',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: seeded.period.id,
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: seeded.planItem.id,
        importBatchId: seeded.batch.id,
        importedRowId: seeded.row.id,
        sourceFingerprint: seeded.fingerprint,
        title: 'Phone bill',
        occurredOn: new Date('2026-03-12T00:00:00.000Z'),
        amount: 75_000,
        status: CollectedTransactionStatus.READY_TO_POST,
        memo: 'Imported recurring bill',
        createdAt: context.state.collectedTransactions.find(
          (candidate) => candidate.id === 'ctx-recurring-existing'
        )?.createdAt,
        updatedAt: context.state.collectedTransactions.find(
          (candidate) => candidate.id === 'ctx-recurring-existing'
        )?.updatedAt
      }
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 409 when the matched recurring transaction is already linked to another import row', async () => {
  const context = await createRequestTestContext();

  try {
    const seeded = seedCollectableImportScenario(context, {
      periodId: 'period-open-recurring-conflict',
      batchId: 'import-batch-recurring-conflict',
      rowId: 'imported-row-recurring-conflict',
      planItemId: 'plan-item-recurring-conflict',
      title: 'Streaming bill',
      amount: 21_000,
      planItemTitle: 'Streaming bill'
    });

    context.state.planItems = context.state.planItems.map((candidate) =>
      candidate.id === seeded.planItem.id
        ? {
            ...candidate,
            status: PlanItemStatus.MATCHED,
            updatedAt: new Date()
          }
        : candidate
    );

    pushCollectedTransaction(context, {
      id: 'ctx-recurring-conflict',
      periodId: seeded.period.id,
      matchedPlanItemId: seeded.planItem.id,
      title: 'Streaming bill',
      amount: 21_000,
      occurredOn: new Date('2026-03-11T00:00:00.000Z'),
      status: CollectedTransactionStatus.READY_TO_POST
    });
    context.state.simulateCollectedTransactionAlreadyLinkedOnNextImportClaimId =
      'ctx-recurring-conflict';

    const response = await context.request(
      '/import-batches/import-batch-recurring-conflict/rows/imported-row-recurring-conflict/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Retry imported recurring bill'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message:
        '이미 다른 업로드 행과 연결된 반복 수집 거래입니다. 다시 새로고침해 주세요.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.collectedTransactions.filter(
        (candidate) => candidate.matchedPlanItemId === seeded.planItem.id
      ).length,
      1
    );
  } finally {
    await context.close();
  }
});

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
          fundingAccountId: 'acc-1'
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
