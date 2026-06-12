import { Module } from '@nestjs/common';
import { AccountingPeriodReaderPort } from './application/ports/accounting-period-reader.port';
import { AccountingPeriodWriteGuardPort } from './application/ports/accounting-period-write-guard.port';
import { AccountingPeriodLifecyclePort } from './application/ports/accounting-period-lifecycle.port';
import { CloseAccountingPeriodUseCase } from './application/use-cases/close-accounting-period.use-case';
import { OpenAccountingPeriodUseCase } from './application/use-cases/open-accounting-period.use-case';
import { ReopenAccountingPeriodUseCase } from './application/use-cases/reopen-accounting-period.use-case';
import { AccountingPeriodsController } from './accounting-periods.controller';
import { AccountingPeriodsService } from './infrastructure/services/accounting-periods.service';
import { PrismaAccountingPeriodGatewayAdapter } from './infrastructure/prisma/prisma-accounting-period-gateway.adapter';
import { PrismaAccountingPeriodLifecycleAdapter } from './infrastructure/services/prisma-accounting-period-lifecycle.adapter';
import { PrismaCloseAccountingPeriodLifecycle } from './infrastructure/services/prisma-close-accounting-period.lifecycle';
import { PrismaOpenAccountingPeriodLifecycle } from './infrastructure/services/prisma-open-accounting-period.lifecycle';
import { PrismaReopenAccountingPeriodLifecycle } from './infrastructure/services/prisma-reopen-accounting-period.lifecycle';

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
    PrismaOpenAccountingPeriodLifecycle,
    PrismaCloseAccountingPeriodLifecycle,
    PrismaReopenAccountingPeriodLifecycle,
    PrismaAccountingPeriodLifecycleAdapter,
    {
      provide: AccountingPeriodLifecyclePort,
      useExisting: PrismaAccountingPeriodLifecycleAdapter
    },
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
