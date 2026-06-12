import type {
  AuthenticatedUser,
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { ImportBatchCommandPort } from '../ports/import-batch-command.port';

@ApplicationService()
export class BulkCollectImportedRowsUseCase {
  constructor(private readonly commands: ImportBatchCommandPort) {}

  execute(
    user: AuthenticatedUser,
    importBatchId: string,
    input: BulkCollectImportedRowsRequest
  ): Promise<BulkCollectImportedRowsResponse> {
    return this.commands.bulkCollectRows(user, importBatchId, input);
  }
}
