import type {
  AuthenticatedUser,
  CollectImportedRowPreview,
  CollectImportedRowRequest
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { ImportBatchCommandPort } from '../ports/import-batch-command.port';

@ApplicationService()
export class PreviewImportedRowCollectionUseCase {
  constructor(private readonly commands: ImportBatchCommandPort) {}

  execute(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectImportedRowPreview> {
    return this.commands.previewRow(user, importBatchId, importedRowId, input);
  }
}
