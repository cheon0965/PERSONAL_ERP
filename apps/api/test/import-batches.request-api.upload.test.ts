import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
import { buildImportRowFingerprint } from './import-batches.request-api.shared';

test('POST /import-batches creates an import batch and imported rows from UTF-8 text content', async () => {
  const context = await createRequestTestContext();

  try {
    const content = [
      'date,title,amount',
      '2026-03-02,Coffee,4800',
      '2026-03-03,Lunch,15000'
    ].join('\n');
    const expectedHash = createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
    const firstFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-02',
      amount: 4_800,
      title: 'Coffee'
    });
    const secondFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-03',
      amount: 15_000,
      title: 'Lunch'
    });

    const response = await context.request('/import-batches', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        fileName: 'march-manual.csv',
        content
      }
    });

    const created = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(created.id, 'import-batch-1');
    assert.equal(created.sourceKind, ImportSourceKind.MANUAL_UPLOAD);
    assert.equal(created.fileName, 'march-manual.csv');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
    assert.equal(created.parsedRowCount, 2);
    assert.equal(created.failedRowCount, 0);
    assert.equal(typeof created.uploadedAt, 'string');
    assert.deepEqual(created.rows, [
      {
        id: 'imported-row-1',
        rowNumber: 2,
        parseStatus: ImportedRowParseStatus.PARSED,
        parseError: null,
        sourceFingerprint: firstFingerprint,
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: {
            date: '2026-03-02',
            title: 'Coffee',
            amount: '4800'
          },
          parsed: {
            occurredOn: '2026-03-02',
            title: 'Coffee',
            amount: 4_800
          }
        }
      },
      {
        id: 'imported-row-2',
        rowNumber: 3,
        parseStatus: ImportedRowParseStatus.PARSED,
        parseError: null,
        sourceFingerprint: secondFingerprint,
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: {
            date: '2026-03-03',
            title: 'Lunch',
            amount: '15000'
          },
          parsed: {
            occurredOn: '2026-03-03',
            title: 'Lunch',
            amount: 15_000
          }
        }
      }
    ]);
    assert.equal(context.state.importBatches.length, 1);
    assert.equal(context.state.importedRows.length, 2);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'import_batch.upload' &&
          candidate.details.importBatchId === 'import-batch-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches returns 403 when the current membership role cannot upload batches', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/import-batches', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        fileName: 'march-manual.csv',
        content: 'date,title,amount\n2026-03-02,Coffee,4800'
      }
    });

    assert.equal(response.status, 403);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'import_batch.upload' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});
