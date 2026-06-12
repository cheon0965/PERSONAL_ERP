import type {
  AuthenticatedUser,
  CreateImportBatchRequest,
  ImportBatchItem
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { ImportBatchCommandPort } from '../ports/import-batch-command.port';

@ApplicationService()
export class CreateImportBatchUseCase {
  constructor(private readonly commands: ImportBatchCommandPort) {}

  execute(
    user: AuthenticatedUser,
    input: CreateImportBatchRequest
  ): Promise<ImportBatchItem> {
    return this.commands.create(user, input);
  }
}
