import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/public';
import { ImportBatchWritePort } from './application/ports/import-batch-write.port';
import { ImportedRowCollectionPort } from './application/ports/imported-row-collection.port';
import { CollectImportedRowUseCase } from './application/use-cases/collect-imported-row.use-case';
import { BulkCollectImportedRowsUseCase } from './application/use-cases/bulk-collect-imported-rows.use-case';
import { CreateImportBatchFromFileUseCase } from './application/use-cases/create-import-batch-from-file.use-case';
import { CreateImportBatchUseCase } from './application/use-cases/create-import-batch.use-case';
import { DeleteImportBatchUseCase } from './application/use-cases/delete-import-batch.use-case';
import { PreviewImportedRowCollectionUseCase } from './application/use-cases/preview-imported-row-collection.use-case';
import { ImportBatchQueryService } from './import-batch-query.service';
import { ImportBatchesController } from './import-batches.controller';
import { PrismaImportBatchWriteAdapter } from './infrastructure/prisma/prisma-import-batch-write.adapter';
import { ImportedRowCollectionRepository } from './imported-row-collection.repository';
import { ImportedRowCollectionService } from './imported-row-collection.service';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [ImportBatchesController],
  providers: [
    ImportBatchQueryService,
    PrismaImportBatchWriteAdapter,
    {
      provide: ImportBatchWritePort,
      useExisting: PrismaImportBatchWriteAdapter
    },
    ImportedRowCollectionRepository,
    {
      provide: ImportedRowCollectionPort,
      useExisting: ImportedRowCollectionRepository
    },
    ImportedRowCollectionService,
    CreateImportBatchUseCase,
    CreateImportBatchFromFileUseCase,
    PreviewImportedRowCollectionUseCase,
    CollectImportedRowUseCase,
    BulkCollectImportedRowsUseCase,
    DeleteImportBatchUseCase
  ],
  exports: [ImportBatchQueryService]
})
export class ImportBatchesModule {}
