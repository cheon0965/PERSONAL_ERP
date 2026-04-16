import type {
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse,
  CreateImportBatchRequest,
  ImportBatchItem
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';
import {
  buildImportBatchFallbackItem,
  buildImportedCollectedFallbackPreview,
  buildImportedCollectedFallbackResponse,
  mockImportBatches
} from './imports.api.fallback';

export const importBatchesQueryKey = ['import-batches'] as const;

export { mockImportBatches };
export {
  buildImportBatchFallbackItem,
  buildImportedCollectedFallbackPreview,
  buildImportedCollectedFallbackResponse
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
