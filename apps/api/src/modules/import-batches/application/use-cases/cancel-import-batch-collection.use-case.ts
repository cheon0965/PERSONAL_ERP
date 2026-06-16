import type {
  AuthenticatedUser,
  CancelImportBatchCollectionResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { ImportBatchCommandPort } from '../ports/import-batch-command.port';

@ApplicationService()
export class CancelImportBatchCollectionUseCase {
  constructor(private readonly commands: ImportBatchCommandPort) {}

  execute(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<CancelImportBatchCollectionResponse | null> {
    return this.commands.cancelCollection(user, importBatchId);
  }
}
