import type {
  AuthenticatedUser,
  ImportBatchItem
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { CreateImportBatchFromFileInput } from '../models/create-import-batch-from-file.input';
import { ImportBatchCommandPort } from '../ports/import-batch-command.port';

export type { CreateImportBatchFromFileInput } from '../models/create-import-batch-from-file.input';

@ApplicationService()
export class CreateImportBatchFromFileUseCase {
  constructor(private readonly commands: ImportBatchCommandPort) {}

  execute(
    user: AuthenticatedUser,
    input: CreateImportBatchFromFileInput
  ): Promise<ImportBatchItem> {
    return this.commands.createFromFile(user, input);
  }
}
