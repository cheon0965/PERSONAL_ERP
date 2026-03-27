import { Module } from '@nestjs/common';
import { ReferenceOwnershipPort } from './application/ports/reference-ownership.port';
import { TransactionStorePort } from './application/ports/transaction-store.port';
import { CreateTransactionUseCase } from './application/use-cases/create-transaction.use-case';
import { ListTransactionsUseCase } from './application/use-cases/list-transactions.use-case';
import { PrismaReferenceOwnershipAdapter } from './infrastructure/prisma/prisma-reference-ownership.adapter';
import { PrismaTransactionStoreAdapter } from './infrastructure/prisma/prisma-transaction-store.adapter';
import { TransactionsController } from './transactions.controller';

@Module({
  controllers: [TransactionsController],
  providers: [
    PrismaTransactionStoreAdapter,
    PrismaReferenceOwnershipAdapter,
    {
      provide: TransactionStorePort,
      useExisting: PrismaTransactionStoreAdapter
    },
    {
      provide: ReferenceOwnershipPort,
      useExisting: PrismaReferenceOwnershipAdapter
    },
    {
      provide: ListTransactionsUseCase,
      useFactory: (transactionStore: TransactionStorePort) =>
        new ListTransactionsUseCase(transactionStore),
      inject: [TransactionStorePort]
    },
    {
      provide: CreateTransactionUseCase,
      useFactory: (
        transactionStore: TransactionStorePort,
        referenceOwnership: ReferenceOwnershipPort
      ) => new CreateTransactionUseCase(transactionStore, referenceOwnership),
      inject: [TransactionStorePort, ReferenceOwnershipPort]
    }
  ]
})
export class TransactionsModule {}
