import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/public';
import { LiabilitiesController } from './liabilities.controller';
import { LiabilitiesService } from './services/liabilities.service';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [LiabilitiesController],
  providers: [LiabilitiesService],
  exports: [LiabilitiesService]
})
export class LiabilitiesModule {}
