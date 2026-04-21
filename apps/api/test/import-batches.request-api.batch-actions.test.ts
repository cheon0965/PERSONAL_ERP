import assert from 'node:assert/strict';
import test from 'node:test';
import type { ImportBatchCollectionJobItem } from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  ImportBatchParseStatus,
  ImportSourceKind
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
import {
  buildImportRowFingerprint,
  pushCollectedTransaction,
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
          message: '카테고리 보완 전까지 검토 상태로 저장합니다.'
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
