import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/accounting-periods.module';
import { ImportBatchesController } from './import-batches.controller';
import { ImportBatchesService } from './import-batches.service';
import { ImportedRowCollectionRepository } from './imported-row-collection.repository';
import { ImportedRowCollectionService } from './imported-row-collection.service';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [ImportBatchesController],
  providers: [
    ImportBatchesService,
    ImportedRowCollectionRepository,
    ImportedRowCollectionService
  ],
  exports: [ImportBatchesService]
})
export class ImportBatchesModule {}
