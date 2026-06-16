import type {
  AuthenticatedUser,
  ImportBatchCollectionJobItem
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { ImportBatchCommandPort } from '../ports/import-batch-command.port';

@ApplicationService()
export class GetImportBatchCollectionJobUseCase {
  constructor(private readonly commands: ImportBatchCommandPort) {}

  execute(
    user: AuthenticatedUser,
    importBatchId: string,
    jobId: string
  ): Promise<ImportBatchCollectionJobItem> {
    return this.commands.getCollectionJob(user, importBatchId, jobId);
  }
}
