import type {
  AuthenticatedUser,
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsResponse,
  CancelImportBatchCollectionResponse,
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse,
  CreateImportBatchRequest,
  ImportBatchCollectionJobItem,
  ImportBatchItem
} from '@personal-erp/contracts';
import type { CreateImportBatchFromFileInput } from '../models/create-import-batch-from-file.input';

export abstract class ImportBatchCommandPort {
  abstract create(
    user: AuthenticatedUser,
    input: CreateImportBatchRequest
  ): Promise<ImportBatchItem>;

  abstract createFromFile(
    user: AuthenticatedUser,
    input: CreateImportBatchFromFileInput
  ): Promise<ImportBatchItem>;

  abstract previewRow(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectImportedRowPreview>;

  abstract collectRow(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectImportedRowResponse>;

  abstract bulkCollectRows(
    user: AuthenticatedUser,
    importBatchId: string,
    input: BulkCollectImportedRowsRequest
  ): Promise<BulkCollectImportedRowsResponse>;

  abstract cancelCollection(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<CancelImportBatchCollectionResponse | null>;

  abstract cancelCollectionJob(
    user: AuthenticatedUser,
    importBatchId: string,
    jobId: string
  ): Promise<ImportBatchCollectionJobItem>;

  abstract getCollectionJob(
    user: AuthenticatedUser,
    importBatchId: string,
    jobId: string
  ): Promise<ImportBatchCollectionJobItem>;

  abstract getActiveCollectionJob(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<ImportBatchCollectionJobItem | null>;

  abstract delete(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<boolean>;
}
