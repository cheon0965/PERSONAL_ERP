import assert from 'node:assert/strict';
import test from 'node:test';
import type { ImportBatchCollectionJobItem } from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  ImportBatchParseStatus,
  ImportSourceKind,
  PlanItemStatus,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
import {
  buildImportRowFingerprint,
  pushCollectedTransaction,
  pushDraftPlanItem,
  pushImportBatch,
  pushImportedRow,
  pushOpenCollectingPeriod
} from './import-batches.request-api.shared';

async function readCollectionJobUntilDone(
  context: Awaited<ReturnType<typeof createRequestTestContext>>,
  importBatchId: string,
  jobId: string
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await context.request(
      `/import-batches/${importBatchId}/collection-jobs/${jobId}`,
      {
        method: 'GET',
        headers: context.authHeaders()
      }
    );
    assert.equal(response.status, 200);

    const job = response.body as ImportBatchCollectionJobItem;
    if (
      job.status === 'SUCCEEDED' ||
      job.status === 'PARTIAL' ||
      job.status === 'FAILED' ||
      job.status === 'CANCELLED'
    ) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('일괄 등록 작업이 제한 시간 안에 완료되지 않았습니다.');
}

test('POST /import-batches/:id/rows/collect bulk-collects selected rows and infers income or expense from parsed direction', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-bulk-collect',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank.pdf',
      fileHash: 'hash-bulk-collect',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-deposit',
      batchId: 'import-batch-bulk-collect',
      rowNumber: 1,
      occurredOn: '2026-03-12',
      title: '입금 테스트',
      amount: 50_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-12',
        amount: 50_000,
        title: '입금 테스트'
      }),
      parsed: {
        occurredOn: '2026-03-12',
        title: '입금 테스트',
        amount: 50_000,
        direction: 'DEPOSIT',
        balanceAfter: 250_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-withdrawal',
      batchId: 'import-batch-bulk-collect',
      rowNumber: 2,
      occurredOn: '2026-03-13',
      title: '출금 테스트',
      amount: 17_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-13',
        amount: 17_000,
        title: '출금 테스트'
      }),
      parsed: {
        occurredOn: '2026-03-13',
        title: '출금 테스트',
        amount: 17_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 233_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-collect/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-deposit', 'imported-row-withdrawal'],
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    assert.equal(startedJob.importBatchId, 'import-batch-bulk-collect');
    assert.equal(startedJob.requestedRowCount, 2);

    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-bulk-collect',
      startedJob.id
    );
    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.equal(completedJob.processedRowCount, 2);
    assert.equal(completedJob.succeededCount, 2);
    assert.equal(completedJob.failedCount, 0);
    assert.deepEqual(
      completedJob.results.map((result) => ({
        importedRowId: result.importedRowId,
        rowNumber: result.rowNumber,
        status: result.status,
        collectedTransactionId: result.collectedTransactionId,
        message: result.message
      })),
      [
        {
          importedRowId: 'imported-row-deposit',
          rowNumber: 1,
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-4',
          message:
            '2026-03 운영 시작 전 기초 입력으로 운영월을 자동 생성하고 등록했습니다.'
        },
        {
          importedRowId: 'imported-row-withdrawal',
          rowNumber: 2,
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-5',
          message: '카테고리 보완 전까지 검토 상태로 저장합니다.'
        }
      ]
    );
    assert.equal(context.state.collectedTransactions.length, 5);
    assert.deepEqual(context.state.accountingPeriods, [
      {
        id: 'period-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 3,
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        status: 'OPEN',
        nextJournalEntrySequence: 1,
        openedAt: context.state.accountingPeriods[0]?.openedAt,
        lockedAt: null,
        createdAt: context.state.accountingPeriods[0]?.createdAt,
        updatedAt: context.state.accountingPeriods[0]?.updatedAt
      }
    ]);
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-4'
      )?.ledgerTransactionTypeId,
      'ltt-1-income'
    );
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-5'
      )?.ledgerTransactionTypeId,
      'ltt-1-expense'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect applies a shared type and category to selected rows', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-bulk-classify',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank-classify.pdf',
      fileHash: 'hash-bulk-classify',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-classify-1',
      batchId: 'import-batch-bulk-classify',
      rowNumber: 1,
      occurredOn: '2026-03-12',
      title: '주유소 A',
      amount: 50_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-12',
        amount: 50_000,
        title: '주유소 A'
      }),
      parsed: {
        occurredOn: '2026-03-12',
        title: '주유소 A',
        amount: 50_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 250_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-classify-2',
      batchId: 'import-batch-bulk-classify',
      rowNumber: 2,
      occurredOn: '2026-03-13',
      title: '주유소 B',
      amount: 47_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-13',
        amount: 47_000,
        title: '주유소 B'
      }),
      parsed: {
        occurredOn: '2026-03-13',
        title: '주유소 B',
        amount: 47_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 203_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-classify/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-classify-1', 'imported-row-classify-2'],
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-bulk-classify',
      startedJob.id
    );

    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.deepEqual(
      completedJob.results.map((result) => result.message),
      [
        '2026-03 운영 시작 전 기초 입력으로 운영월을 자동 생성하고 등록했습니다.',
        '즉시 전표 준비 상태로 올립니다.'
      ]
    );
    assert.deepEqual(
      context.state.collectedTransactions
        .filter((candidate) => ['ctx-4', 'ctx-5'].includes(candidate.id))
        .map((candidate) => ({
          ledgerTransactionTypeId: candidate.ledgerTransactionTypeId,
          categoryId: candidate.categoryId,
          status: candidate.status
        })),
      [
        {
          ledgerTransactionTypeId: 'ltt-1-expense',
          categoryId: 'cat-1',
          status: CollectedTransactionStatus.READY_TO_POST
        },
        {
          ledgerTransactionTypeId: 'ltt-1-expense',
          categoryId: 'cat-1',
          status: CollectedTransactionStatus.READY_TO_POST
        }
      ]
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect applies category and memo by inferred transaction type', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-bulk-type-options'
    });
    pushImportBatch(context, {
      id: 'import-batch-bulk-type-options',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank-type-options.pdf',
      fileHash: 'hash-bulk-type-options',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-type-options-income',
      batchId: 'import-batch-bulk-type-options',
      rowNumber: 1,
      occurredOn: '2026-03-24',
      title: '정산 입금',
      amount: 140_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-24',
        amount: 140_000,
        title: '정산 입금'
      }),
      parsed: {
        occurredOn: '2026-03-24',
        title: '정산 입금',
        amount: 140_000,
        direction: 'DEPOSIT',
        balanceAfter: 370_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-type-options-expense',
      batchId: 'import-batch-bulk-type-options',
      rowNumber: 2,
      occurredOn: '2026-03-25',
      title: '주유 결제',
      amount: 60_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-25',
        amount: 60_000,
        title: '주유 결제'
      }),
      parsed: {
        occurredOn: '2026-03-25',
        title: '주유 결제',
        amount: 60_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 310_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-type-options/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: [
            'imported-row-type-options-income',
            'imported-row-type-options-expense'
          ],
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1c',
          memo: '공통 메모',
          typeOptions: [
            {
              type: TransactionType.INCOME,
              categoryId: 'cat-1b',
              memo: '수입 일괄 메모'
            },
            {
              type: TransactionType.EXPENSE,
              categoryId: 'cat-1',
              memo: '지출 일괄 메모'
            }
          ]
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-bulk-type-options',
      startedJob.id
    );

    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.deepEqual(
      context.state.collectedTransactions
        .filter((candidate) => ['ctx-4', 'ctx-5'].includes(candidate.id))
        .map((candidate) => ({
          ledgerTransactionTypeId: candidate.ledgerTransactionTypeId,
          categoryId: candidate.categoryId,
          memo: candidate.memo,
          status: candidate.status
        })),
      [
        {
          ledgerTransactionTypeId: 'ltt-1-income',
          categoryId: 'cat-1b',
          memo: '수입 일괄 메모',
          status: CollectedTransactionStatus.READY_TO_POST
        },
        {
          ledgerTransactionTypeId: 'ltt-1-expense',
          categoryId: 'cat-1',
          memo: '지출 일괄 메모',
          status: CollectedTransactionStatus.READY_TO_POST
        }
      ]
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect maps 승인취소 행 to the adjustment transaction type', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-bulk-collect-reversal'
    });
    pushImportBatch(context, {
      id: 'import-batch-bulk-collect-reversal',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank-reversal.pdf',
      fileHash: 'hash-bulk-collect-reversal',
      fundingAccountId: 'acc-1',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-reversal',
      batchId: 'import-batch-bulk-collect-reversal',
      rowNumber: 1,
      occurredOn: '2026-03-20',
      title: '기분좋은self주유',
      amount: 140_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-20',
        amount: 140_000,
        title: '기분좋은self주유'
      }),
      parsed: {
        occurredOn: '2026-03-20',
        title: '기분좋은self주유',
        amount: 140_000,
        direction: 'REVERSAL',
        directionLabel: '승인취소',
        collectTypeHint: 'REVERSAL',
        balanceAfter: 18_667_536,
        reversalTargetRowNumber: 3
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-collect-reversal/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-reversal'],
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-bulk-collect-reversal',
      startedJob.id
    );
    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.equal(completedJob.requestedRowCount, 1);
    assert.equal(completedJob.succeededCount, 1);
    assert.equal(completedJob.failedCount, 0);
    assert.deepEqual(
      completedJob.results.map((result) => ({
        importedRowId: result.importedRowId,
        rowNumber: result.rowNumber,
        status: result.status,
        collectedTransactionId: result.collectedTransactionId,
        message: result.message
      })),
      [
        {
          importedRowId: 'imported-row-reversal',
          rowNumber: 1,
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-4',
          message: '승인취소 거래라 카테고리 없이도 전표 준비 상태로 올립니다.'
        }
      ]
    );
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-4'
      )?.ledgerTransactionTypeId,
      'ltt-1-adjustment'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect blocks another workspace bulk job while one is active', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-bulk-collect-lock'
    });
    pushImportBatch(context, {
      id: 'import-batch-bulk-collect-lock',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank-lock.pdf',
      fileHash: 'hash-bulk-collect-lock',
      fundingAccountId: 'acc-1',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-lock',
      batchId: 'import-batch-bulk-collect-lock',
      rowNumber: 1,
      occurredOn: '2026-03-22',
      title: '동시 작업 테스트',
      amount: 10_000
    });
    context.state.importBatchCollectionLocks.push({
      id: 'import-batch-collection-lock-existing',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      importBatchId: 'import-batch-other-active',
      jobId: 'import-batch-collection-job-active',
      lockedByMembershipId: 'membership-2',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-collect-lock/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-lock'],
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message: string }).message,
      '현재 워크스페이스에서 다른 업로드 배치 일괄 등록이 진행 중입니다. 완료 후 다시 시도해 주세요.'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/cancel-collection cancels unposted collected transactions and restores matched plans', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-cancel-collection'
    });
    pushImportBatch(context, {
      id: 'import-batch-cancel-collection',
      fileName: 'cancel-collection.csv',
      fileHash: 'hash-cancel-collection',
      rowCount: 2
    });
    pushImportedRow(context, {
      id: 'imported-row-cancel-collection-1',
      batchId: 'import-batch-cancel-collection',
      rowNumber: 1
    });
    pushImportedRow(context, {
      id: 'imported-row-cancel-collection-2',
      batchId: 'import-batch-cancel-collection',
      rowNumber: 2
    });
    pushDraftPlanItem(context, {
      id: 'plan-item-cancel-collection',
      periodId: 'period-open-cancel-collection',
      status: PlanItemStatus.MATCHED
    });
    pushCollectedTransaction(context, {
      id: 'ctx-cancel-collection-1',
      periodId: 'period-open-cancel-collection',
      importBatchId: 'import-batch-cancel-collection',
      importedRowId: 'imported-row-cancel-collection-1',
      matchedPlanItemId: 'plan-item-cancel-collection',
      status: CollectedTransactionStatus.READY_TO_POST
    });
    pushCollectedTransaction(context, {
      id: 'ctx-cancel-collection-2',
      periodId: 'period-open-cancel-collection',
      importBatchId: 'import-batch-cancel-collection',
      importedRowId: 'imported-row-cancel-collection-2',
      matchedPlanItemId: null,
      status: CollectedTransactionStatus.REVIEWED
    });

    const response = await context.request(
      '/import-batches/import-batch-cancel-collection/cancel-collection',
      {
        method: 'POST',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      importBatchId: 'import-batch-cancel-collection',
      cancelledTransactionCount: 2,
      restoredPlanItemCount: 1
    });
    assert.equal(
      context.state.collectedTransactions.some((candidate) =>
        ['ctx-cancel-collection-1', 'ctx-cancel-collection-2'].includes(
          candidate.id
        )
      ),
      false
    );
    assert.equal(
      context.state.planItems.find(
        (candidate) => candidate.id === 'plan-item-cancel-collection'
      )?.status,
      PlanItemStatus.DRAFT
    );
    assert.ok(
      context.state.importBatches.some(
        (candidate) => candidate.id === 'import-batch-cancel-collection'
      )
    );
    assert.equal(
      context.state.importedRows.filter(
        (candidate) => candidate.batchId === 'import-batch-cancel-collection'
      ).length,
      2
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'import_batch.cancel' &&
          candidate.details.importBatchId ===
            'import-batch-cancel-collection' &&
          candidate.details.cancelledTransactionCount === 2
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/cancel-collection blocks batches with posted collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-cancel-posted',
      fileName: 'cancel-posted.csv',
      fileHash: 'hash-cancel-posted'
    });
    pushImportedRow(context, {
      id: 'imported-row-cancel-posted',
      batchId: 'import-batch-cancel-posted'
    });
    pushCollectedTransaction(context, {
      id: 'ctx-cancel-posted',
      importBatchId: 'import-batch-cancel-posted',
      importedRowId: 'imported-row-cancel-posted',
      status: CollectedTransactionStatus.POSTED
    });

    const response = await context.request(
      '/import-batches/import-batch-cancel-posted/cancel-collection',
      {
        method: 'POST',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message: string }).message,
      '이미 전표 확정 또는 정정 흐름에 들어간 수집 거래가 있어 업로드 배치 등록을 전체 취소할 수 없습니다. 전표 화면에서 반전 또는 정정으로 처리해 주세요.'
    );
    assert.ok(
      context.state.collectedTransactions.some(
        (candidate) => candidate.id === 'ctx-cancel-posted'
      )
    );
  } finally {
    await context.close();
  }
});

test('DELETE /import-batches/:id deletes an unlinked import batch and its rows', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-delete',
      fileName: 'delete-me.csv',
      fileHash: 'hash-delete-me',
      rowCount: 2
    });
    pushImportedRow(context, {
      id: 'imported-row-delete-batch-1',
      batchId: 'import-batch-delete'
    });
    pushImportedRow(context, {
      id: 'imported-row-delete-batch-2',
      batchId: 'import-batch-delete',
      rowNumber: 3
    });

    const response = await context.request(
      '/import-batches/import-batch-delete',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 204);
    assert.equal(
      context.state.importBatches.some(
        (candidate) => candidate.id === 'import-batch-delete'
      ),
      false
    );
    assert.equal(
      context.state.importedRows.some(
        (candidate) => candidate.batchId === 'import-batch-delete'
      ),
      false
    );
  } finally {
    await context.close();
  }
});

test('DELETE /import-batches/:id returns 409 when the batch is already linked to collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-linked-delete',
      fileName: 'linked-delete.csv',
      fileHash: 'hash-linked-delete'
    });
    pushImportedRow(context, {
      id: 'imported-row-linked-delete',
      batchId: 'import-batch-linked-delete',
      sourceFingerprint: buildImportRowFingerprint({
        occurredOn: '2026-03-12',
        amount: 12_000,
        title: '연결된 행'
      })
    });
    pushCollectedTransaction(context, {
      id: 'ctx-import-linked-delete',
      importBatchId: 'import-batch-linked-delete',
      importedRowId: 'imported-row-linked-delete',
      title: '연결된 수집 거래',
      amount: 12_000,
      status: CollectedTransactionStatus.COLLECTED,
      occurredOn: new Date('2026-03-12T00:00:00.000Z')
    });

    const response = await context.request(
      '/import-batches/import-batch-linked-delete',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message:
        '이미 수집 거래와 연결된 업로드 배치는 삭제할 수 없습니다. 먼저 연결된 수집 거래를 정리해 주세요.',
      error: 'Conflict'
    });
  } finally {
    await context.close();
  }
});
