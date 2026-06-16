import type { ImportBatchCollectionJobItem } from '@personal-erp/contracts';
import type {
  ImportBatchCollectionJobStatus,
  ImportBatchCollectionJobRowStatus
} from '@prisma/client';

export type ImportBatchCollectionJobWithRows = {
  id: string;
  importBatchId: string;
  status: ImportBatchCollectionJobStatus;
  requestedRowCount: number;
  processedRowCount: number;
  succeededCount: number;
  failedCount: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  heartbeatAt: Date | null;
  rows: Array<{
    importedRowId: string;
    rowNumber: number;
    status: ImportBatchCollectionJobRowStatus;
    collectedTransactionId: string | null;
    message: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>;
};

export const importBatchCollectionJobSelect = {
  id: true,
  importBatchId: true,
  status: true,
  requestedRowCount: true,
  processedRowCount: true,
  succeededCount: true,
  failedCount: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  heartbeatAt: true,
  rows: {
    orderBy: {
      rowNumber: 'asc'
    },
    select: {
      id: true,
      jobId: true,
      importedRowId: true,
      rowNumber: true,
      status: true,
      collectedTransactionId: true,
      message: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true
    }
  }
} as const;

export function mapImportBatchCollectionJobToItem(
  job: ImportBatchCollectionJobWithRows
): ImportBatchCollectionJobItem {
  return {
    id: job.id,
    importBatchId: job.importBatchId,
    status: job.status,
    requestedRowCount: job.requestedRowCount,
    processedRowCount: job.processedRowCount,
    succeededCount: job.succeededCount,
    failedCount: job.failedCount,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    heartbeatAt: job.heartbeatAt?.toISOString() ?? null,
    results: job.rows.map((row) => ({
      importedRowId: row.importedRowId,
      rowNumber: row.rowNumber,
      status: row.status,
      collectedTransactionId: row.collectedTransactionId,
      message: row.message,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null
    }))
  };
}
