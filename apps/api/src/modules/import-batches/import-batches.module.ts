import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/accounting-periods.module';
import { ImportBatchesController } from './import-batches.controller';
import { ImportBatchesService } from './import-batches.service';
import { ImportedRowCollectionService } from './imported-row-collection.service';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [ImportBatchesController],
  providers: [ImportBatchesService, ImportedRowCollectionService],
  exports: [ImportBatchesService]
})
export class ImportBatchesModule {}
