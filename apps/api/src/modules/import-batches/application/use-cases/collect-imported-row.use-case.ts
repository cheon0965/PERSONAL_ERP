import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowRequest,
  CollectImportedRowResponse
} from '@personal-erp/contracts';
import { ImportedRowCollectionService } from '../../imported-row-collection.service';

@Injectable()
export class CollectImportedRowUseCase {
  constructor(
    private readonly importedRowCollectionService: ImportedRowCollectionService
  ) {}

  execute(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectImportedRowResponse> {
    return this.importedRowCollectionService.collectRow(
      user,
      importBatchId,
      importedRowId,
      input
    );
  }
}
