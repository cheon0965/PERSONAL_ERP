import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/accounting-periods.module';
import { ImportBatchesController } from './import-batches.controller';
import { ImportBatchesService } from './import-batches.service';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [ImportBatchesController],
  providers: [ImportBatchesService],
  exports: [ImportBatchesService]
})
export class ImportBatchesModule {}
