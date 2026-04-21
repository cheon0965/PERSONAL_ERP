import assert from 'node:assert/strict';
import test from 'node:test';
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

test('POST /import-batches/:id/rows/collect bulk-collects selected rows and infers income or expense from parsed direction', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-bulk-collect'
    });
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

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      importBatchId: 'import-batch-bulk-collect',
      requestedRowCount: 2,
      succeededCount: 2,
      failedCount: 0,
      results: [
        {
          importedRowId: 'imported-row-deposit',
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-4',
          message: '카테고리 보완 전까지 검토 상태로 저장합니다.'
        },
        {
          importedRowId: 'imported-row-withdrawal',
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-5',
          message: '카테고리 보완 전까지 검토 상태로 저장합니다.'
        }
      ]
    });
    assert.equal(context.state.collectedTransactions.length, 5);
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

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      importBatchId: 'import-batch-bulk-collect-reversal',
      requestedRowCount: 1,
      succeededCount: 1,
      failedCount: 0,
      results: [
        {
          importedRowId: 'imported-row-reversal',
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-4',
          message: '승인취소 거래라 카테고리 없이도 전표 준비 상태로 올립니다.'
        }
      ]
    });
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
