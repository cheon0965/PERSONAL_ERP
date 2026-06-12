import type {
  AuthenticatedUser,
  ImportBatchCollectionJobItem
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { ImportBatchCommandPort } from '../ports/import-batch-command.port';

@ApplicationService()
export class GetActiveImportBatchCollectionJobUseCase {
  constructor(private readonly commands: ImportBatchCommandPort) {}

  execute(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<ImportBatchCollectionJobItem | null> {
    return this.commands.getActiveCollectionJob(user, importBatchId);
  }
}
