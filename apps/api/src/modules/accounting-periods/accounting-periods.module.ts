import { Module } from '@nestjs/common';
import { CloseAccountingPeriodUseCase } from './close-accounting-period.use-case';
import { OpenAccountingPeriodUseCase } from './open-accounting-period.use-case';
import { AccountingPeriodsController } from './accounting-periods.controller';
import { AccountingPeriodsService } from './accounting-periods.service';

@Module({
  controllers: [AccountingPeriodsController],
  providers: [
    AccountingPeriodsService,
    OpenAccountingPeriodUseCase,
    CloseAccountingPeriodUseCase
  ],
  exports: [AccountingPeriodsService]
})
export class AccountingPeriodsModule {}
