import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/accounting-periods.module';
import { ReferenceOwnershipPort } from './application/ports/reference-ownership.port';
import { CollectedTransactionStorePort } from './application/ports/collected-transaction-store.port';
import { CreateCollectedTransactionUseCase } from './application/use-cases/create-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from './application/use-cases/list-collected-transactions.use-case';
import { ConfirmCollectedTransactionService } from './confirm-collected-transaction.service';
import { PrismaReferenceOwnershipAdapter } from './infrastructure/prisma/prisma-reference-ownership.adapter';
import { PrismaCollectedTransactionStoreAdapter } from './infrastructure/prisma/prisma-collected-transaction-store.adapter';
import { CollectedTransactionsController } from './collected-transactions.controller';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [CollectedTransactionsController],
  providers: [
    PrismaCollectedTransactionStoreAdapter,
    PrismaReferenceOwnershipAdapter,
    {
      provide: CollectedTransactionStorePort,
      useExisting: PrismaCollectedTransactionStoreAdapter
    },
    {
      provide: ReferenceOwnershipPort,
      useExisting: PrismaReferenceOwnershipAdapter
    },
    {
      provide: ListCollectedTransactionsUseCase,
      useFactory: (
        collectedTransactionStore: CollectedTransactionStorePort
      ) => new ListCollectedTransactionsUseCase(collectedTransactionStore),
      inject: [CollectedTransactionStorePort]
    },
    {
      provide: CreateCollectedTransactionUseCase,
      useFactory: (
        collectedTransactionStore: CollectedTransactionStorePort,
        referenceOwnership: ReferenceOwnershipPort
      ) =>
        new CreateCollectedTransactionUseCase(
          collectedTransactionStore,
          referenceOwnership
      ),
      inject: [CollectedTransactionStorePort, ReferenceOwnershipPort]
    },
    ConfirmCollectedTransactionService
  ]
})
export class CollectedTransactionsModule {}
