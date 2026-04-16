import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowPreview,
  CollectImportedRowRequest
} from '@personal-erp/contracts';
import { ImportedRowCollectionService } from '../../imported-row-collection.service';

@Injectable()
export class PreviewImportedRowCollectionUseCase {
  constructor(
    private readonly importedRowCollectionService: ImportedRowCollectionService
  ) {}

  execute(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectImportedRowPreview> {
    return this.importedRowCollectionService.previewRow(
      user,
      importBatchId,
      importedRowId,
      input
    );
  }
}
