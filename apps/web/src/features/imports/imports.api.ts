import type {
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsResponse,
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse,
  CreateImportBatchRequest,
  ImportBatchCollectionJobItem,
  ImportBatchItem,
  ImportSourceKind
} from '@personal-erp/contracts';
import {
  deleteJson,
  fetchJson,
  postFormData,
  postJson
} from '@/shared/api/fetch-json';
import {
  buildImportBatchFallbackItem,
  buildImportBatchFileFallbackItem,
  buildImportedCollectedFallbackPreview,
  buildImportedCollectedFallbackResponse,
  mockImportBatches
} from './imports.api.fallback';

export const importBatchesQueryKey = ['import-batches'] as const;

export { mockImportBatches };
export {
  buildImportBatchFallbackItem,
  buildImportBatchFileFallbackItem,
  buildImportedCollectedFallbackPreview,
  buildImportedCollectedFallbackResponse
};

export type CreateImportBatchFromFileRequest = {
  sourceKind: ImportSourceKind;
  fileName: string;
  fundingAccountId: string;
  file: File;
};

const bulkCollectFallback: BulkCollectImportedRowsResponse = {
  id: '',
  importBatchId: '',
  status: 'PENDING',
  requestedRowCount: 0,
  processedRowCount: 0,
  succeededCount: 0,
  failedCount: 0,
  errorMessage: null,
  createdAt: new Date(0).toISOString(),
  startedAt: null,
  finishedAt: null,
  heartbeatAt: null,
  results: []
};

export function getImportBatches() {
  return fetchJson<ImportBatchItem[]>('/import-batches', mockImportBatches);
}

export function createImportBatch(
  input: CreateImportBatchRequest,
  fallback: ImportBatchItem
) {
  return postJson<ImportBatchItem, CreateImportBatchRequest>(
    '/import-batches',
    input,
    fallback
  );
}

export function createImportBatchFromFile(
  input: CreateImportBatchFromFileRequest,
  fallback: ImportBatchItem = buildImportBatchFileFallbackItem(input)
) {
  const formData = new FormData();
  formData.set('sourceKind', input.sourceKind);
  formData.set('fundingAccountId', input.fundingAccountId);
  formData.set('file', input.file, input.fileName);

  return postFormData<ImportBatchItem>(
    '/import-batches/files',
    formData,
    fallback
  );
}

export function previewImportedRowCollection(
  importBatchId: string,
  importedRowId: string,
  input: CollectImportedRowRequest,
  fallback: CollectImportedRowPreview
) {
  return postJson<CollectImportedRowPreview, CollectImportedRowRequest>(
    `/import-batches/${importBatchId}/rows/${importedRowId}/collect-preview`,
    input,
    fallback
  );
}

export function collectImportedRow(
  importBatchId: string,
  importedRowId: string,
  input: CollectImportedRowRequest,
  fallback: CollectImportedRowResponse
) {
  return postJson<CollectImportedRowResponse, CollectImportedRowRequest>(
    `/import-batches/${importBatchId}/rows/${importedRowId}/collect`,
    input,
    fallback
  );
}

export function bulkCollectImportedRows(
  importBatchId: string,
  input: BulkCollectImportedRowsRequest
) {
  return postJson<
    BulkCollectImportedRowsResponse,
    BulkCollectImportedRowsRequest
  >(
    `/import-batches/${importBatchId}/rows/collect`,
    input,
    bulkCollectFallback
  );
}

export function getActiveImportBatchCollectionJob(importBatchId: string) {
  return fetchJson<ImportBatchCollectionJobItem | null>(
    `/import-batches/${importBatchId}/collection-jobs/active`,
    null
  );
}

export function getImportBatchCollectionJob(
  importBatchId: string,
  jobId: string
) {
  return fetchJson<ImportBatchCollectionJobItem>(
    `/import-batches/${importBatchId}/collection-jobs/${jobId}`,
    bulkCollectFallback
  );
}

export function deleteImportBatch(importBatchId: string) {
  return deleteJson<null>(`/import-batches/${importBatchId}`, null);
}
