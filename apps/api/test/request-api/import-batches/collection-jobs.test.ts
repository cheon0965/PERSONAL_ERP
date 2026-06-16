import assert from 'node:assert/strict';
import test from 'node:test';
import type { ImportBatchCollectionJobItem } from '@personal-erp/contracts';
import {
  ImportBatchCollectionJobRowStatus,
  ImportBatchCollectionJobStatus,
  ImportBatchParseStatus,
  ImportSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import { pushImportBatch, pushImportedRow } from './shared';

test('POST /import-batches/:id/collection-jobs/:jobId/cancel cancels a pending bulk collection job', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-cancel-job',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'cancel-job.pdf',
      fileHash: 'hash-cancel-job',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });

    const now = new Date('2026-04-23T00:00:00.000Z');
    context.state.importBatchCollectionJobs.push({
      id: 'collection-job-cancel-pending',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      importBatchId: 'import-batch-cancel-job',
      requestedByMembershipId: 'membership-1',
      status: ImportBatchCollectionJobStatus.PENDING,
      requestedRowCount: 2,
      processedRowCount: 0,
      succeededCount: 0,
      failedCount: 0,
      requestPayload: {
        rowIds: ['imported-row-cancel-job-1', 'imported-row-cancel-job-2'],
        fundingAccountId: 'acc-1'
      },
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      heartbeatAt: null,
      createdAt: now,
      updatedAt: now
    });
    context.state.importBatchCollectionJobRows.push(
      {
        id: 'collection-job-cancel-row-1',
        jobId: 'collection-job-cancel-pending',
        importedRowId: 'imported-row-cancel-job-1',
        rowNumber: 1,
        status: ImportBatchCollectionJobRowStatus.PENDING,
        collectedTransactionId: null,
        message: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'collection-job-cancel-row-2',
        jobId: 'collection-job-cancel-pending',
        importedRowId: 'imported-row-cancel-job-2',
        rowNumber: 2,
        status: ImportBatchCollectionJobRowStatus.PENDING,
        collectedTransactionId: null,
        message: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now
      }
    );
    context.state.importBatchCollectionLocks.push({
      id: 'collection-lock-cancel-job',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      importBatchId: 'import-batch-cancel-job',
      jobId: 'collection-job-cancel-pending',
      lockedByMembershipId: 'membership-1',
      expiresAt: new Date('2099-04-23T00:15:00.000Z'),
      createdAt: now,
      updatedAt: now
    });

    const response = await context.request(
      '/import-batches/import-batch-cancel-job/collection-jobs/collection-job-cancel-pending/cancel',
      {
        method: 'POST',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 201);
    const cancelledJob = response.body as ImportBatchCollectionJobItem;
    assert.equal(cancelledJob.status, 'CANCELLED');
    assert.equal(cancelledJob.processedRowCount, 0);
    assert.equal(cancelledJob.finishedAt !== null, true);
    assert.equal(
      cancelledJob.errorMessage,
      '사용자가 업로드 배치 일괄 등록 작업을 중단했습니다.'
    );
    assert.equal(context.state.importBatchCollectionLocks.length, 0);

    const activeJobResponse = await context.request(
      '/import-batches/import-batch-cancel-job/collection-jobs/active',
      {
        method: 'GET',
        headers: context.authHeaders()
      }
    );
    assert.equal(activeJobResponse.status, 200);
    assert.equal(activeJobResponse.body, null);
  } finally {
    await context.close();
  }
});

test('GET /import-batches/:id/collection-jobs/active reconciles expired bulk collection jobs', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-stale-job',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'stale-job.pdf',
      fileHash: 'hash-stale-job',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-stale-collected',
      batchId: 'import-batch-stale-job',
      rowNumber: 1
    });
    pushImportedRow(context, {
      id: 'imported-row-stale-running',
      batchId: 'import-batch-stale-job',
      rowNumber: 2
    });

    const createdAt = new Date('2026-04-23T00:00:00.000Z');
    context.state.importBatchCollectionJobs.push({
      id: 'collection-job-stale',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      importBatchId: 'import-batch-stale-job',
      requestedByMembershipId: 'membership-1',
      status: ImportBatchCollectionJobStatus.RUNNING,
      requestedRowCount: 2,
      processedRowCount: 1,
      succeededCount: 1,
      failedCount: 0,
      requestPayload: {
        rowIds: ['imported-row-stale-collected', 'imported-row-stale-running'],
        fundingAccountId: 'acc-1'
      },
      errorMessage: null,
      startedAt: createdAt,
      finishedAt: null,
      heartbeatAt: createdAt,
      createdAt,
      updatedAt: createdAt
    });
    context.state.importBatchCollectionJobRows.push(
      {
        id: 'collection-job-stale-row-1',
        jobId: 'collection-job-stale',
        importedRowId: 'imported-row-stale-collected',
        rowNumber: 1,
        status: ImportBatchCollectionJobRowStatus.COLLECTED,
        collectedTransactionId: 'collected-transaction-stale',
        message: null,
        startedAt: createdAt,
        finishedAt: createdAt,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'collection-job-stale-row-2',
        jobId: 'collection-job-stale',
        importedRowId: 'imported-row-stale-running',
        rowNumber: 2,
        status: ImportBatchCollectionJobRowStatus.RUNNING,
        collectedTransactionId: null,
        message: null,
        startedAt: createdAt,
        finishedAt: null,
        createdAt,
        updatedAt: createdAt
      }
    );
    context.state.importBatchCollectionLocks.push({
      id: 'collection-lock-stale',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      importBatchId: 'import-batch-stale-job',
      jobId: 'collection-job-stale',
      lockedByMembershipId: 'membership-1',
      expiresAt: new Date('2026-04-23T00:15:00.000Z'),
      createdAt,
      updatedAt: createdAt
    });

    const response = await context.request(
      '/import-batches/import-batch-stale-job/collection-jobs/active',
      {
        method: 'GET',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body, null);
    assert.equal(context.state.importBatchCollectionLocks.length, 0);

    const reconciledJob = context.state.importBatchCollectionJobs.find(
      (job) => job.id === 'collection-job-stale'
    );
    assert.equal(reconciledJob?.status, ImportBatchCollectionJobStatus.PARTIAL);
    assert.equal(reconciledJob?.processedRowCount, 2);
    assert.equal(reconciledJob?.succeededCount, 1);
    assert.equal(reconciledJob?.failedCount, 1);
    assert.equal(reconciledJob?.finishedAt instanceof Date, true);

    const reconciledRow = context.state.importBatchCollectionJobRows.find(
      (row) => row.id === 'collection-job-stale-row-2'
    );
    assert.equal(
      reconciledRow?.status,
      ImportBatchCollectionJobRowStatus.FAILED
    );
    assert.equal(reconciledRow?.finishedAt instanceof Date, true);
  } finally {
    await context.close();
  }
});
