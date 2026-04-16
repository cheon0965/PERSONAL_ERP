import { Module } from '@nestjs/common';
import { AccountingPeriodReaderPort } from './application/ports/accounting-period-reader.port';
import { AccountingPeriodWriteGuardPort } from './application/ports/accounting-period-write-guard.port';
import { CloseAccountingPeriodUseCase } from './close-accounting-period.use-case';
import { OpenAccountingPeriodUseCase } from './open-accounting-period.use-case';
import { ReopenAccountingPeriodUseCase } from './reopen-accounting-period.use-case';
import { AccountingPeriodsController } from './accounting-periods.controller';
import { AccountingPeriodsService } from './accounting-periods.service';
import { PrismaAccountingPeriodGatewayAdapter } from './infrastructure/prisma/prisma-accounting-period-gateway.adapter';

@Module({
  controllers: [AccountingPeriodsController],
  providers: [
    PrismaAccountingPeriodGatewayAdapter,
    {
      provide: AccountingPeriodReaderPort,
      useExisting: PrismaAccountingPeriodGatewayAdapter
    },
    {
      provide: AccountingPeriodWriteGuardPort,
      useExisting: PrismaAccountingPeriodGatewayAdapter
    },
    AccountingPeriodsService,
    OpenAccountingPeriodUseCase,
    CloseAccountingPeriodUseCase,
    ReopenAccountingPeriodUseCase
  ],
  exports: [
    AccountingPeriodsService,
    AccountingPeriodReaderPort,
    AccountingPeriodWriteGuardPort
  ]
})
export class AccountingPeriodsModule {}
