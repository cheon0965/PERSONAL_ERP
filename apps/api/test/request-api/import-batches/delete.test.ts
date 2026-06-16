import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectedTransactionStatus } from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  buildImportRowFingerprint,
  pushCollectedTransaction,
  pushImportBatch,
  pushImportedRow
} from './shared';

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
