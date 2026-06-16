import type { AuthenticatedUser } from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { ImportBatchCommandPort } from '../ports/import-batch-command.port';

@ApplicationService()
export class DeleteImportBatchUseCase {
  constructor(private readonly commands: ImportBatchCommandPort) {}

  execute(user: AuthenticatedUser, importBatchId: string): Promise<boolean> {
    return this.commands.delete(user, importBatchId);
  }
}
