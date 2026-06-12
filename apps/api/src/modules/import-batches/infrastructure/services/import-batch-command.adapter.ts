import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  BulkCollectImportedRowsRequest,
  CollectImportedRowRequest,
  CreateImportBatchRequest
} from '@personal-erp/contracts';
import type { CreateImportBatchFromFileInput } from '../../application/models/create-import-batch-from-file.input';
import { ImportBatchCommandPort } from '../../application/ports/import-batch-command.port';
import { BulkCollectImportedRowsHandler } from './bulk-collect-imported-rows.handler';
import { CancelImportBatchCollectionJobHandler } from './cancel-import-batch-collection-job.handler';
import { CancelImportBatchCollectionHandler } from './cancel-import-batch-collection.handler';
import { CollectImportedRowHandler } from './collect-imported-row.handler';
import {
  CreateImportBatchFromFileHandler,
  type CreateImportBatchFromFileInput as HandlerFileInput
} from './create-import-batch-from-file.handler';
import { CreateImportBatchHandler } from './create-import-batch.handler';
import { DeleteImportBatchHandler } from './delete-import-batch.handler';
import { GetActiveImportBatchCollectionJobHandler } from './get-active-import-batch-collection-job.handler';
import { GetImportBatchCollectionJobHandler } from './get-import-batch-collection-job.handler';
import { PreviewImportedRowCollectionHandler } from './preview-imported-row-collection.handler';

@Injectable()
export class ImportBatchCommandAdapter extends ImportBatchCommandPort {
  constructor(
    private readonly createHandler: CreateImportBatchHandler,
    private readonly createFromFileHandler: CreateImportBatchFromFileHandler,
    private readonly previewHandler: PreviewImportedRowCollectionHandler,
    private readonly collectHandler: CollectImportedRowHandler,
    private readonly bulkCollectHandler: BulkCollectImportedRowsHandler,
    private readonly cancelCollectionHandler: CancelImportBatchCollectionHandler,
    private readonly cancelCollectionJobHandler: CancelImportBatchCollectionJobHandler,
    private readonly getCollectionJobHandler: GetImportBatchCollectionJobHandler,
    private readonly getActiveCollectionJobHandler: GetActiveImportBatchCollectionJobHandler,
    private readonly deleteHandler: DeleteImportBatchHandler
  ) {
    super();
  }

  create(user: AuthenticatedUser, input: CreateImportBatchRequest) {
    return this.createHandler.execute(user, input);
  }

  createFromFile(
    user: AuthenticatedUser,
    input: CreateImportBatchFromFileInput
  ) {
    return this.createFromFileHandler.execute(user, {
      ...input,
      buffer: Buffer.from(input.buffer)
    } satisfies HandlerFileInput);
  }

  previewRow(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ) {
    return this.previewHandler.execute(
      user,
      importBatchId,
      importedRowId,
      input
    );
  }

  collectRow(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ) {
    return this.collectHandler.execute(
      user,
      importBatchId,
      importedRowId,
      input
    );
  }

  bulkCollectRows(
    user: AuthenticatedUser,
    importBatchId: string,
    input: BulkCollectImportedRowsRequest
  ) {
    return this.bulkCollectHandler.execute(user, importBatchId, input);
  }

  cancelCollection(user: AuthenticatedUser, importBatchId: string) {
    return this.cancelCollectionHandler.execute(user, importBatchId);
  }

  cancelCollectionJob(
    user: AuthenticatedUser,
    importBatchId: string,
    jobId: string
  ) {
    return this.cancelCollectionJobHandler.execute(user, importBatchId, jobId);
  }

  getCollectionJob(
    user: AuthenticatedUser,
    importBatchId: string,
    jobId: string
  ) {
    return this.getCollectionJobHandler.execute(user, importBatchId, jobId);
  }

  getActiveCollectionJob(user: AuthenticatedUser, importBatchId: string) {
    return this.getActiveCollectionJobHandler.execute(user, importBatchId);
  }

  delete(user: AuthenticatedUser, importBatchId: string) {
    return this.deleteHandler.execute(user, importBatchId);
  }
}
