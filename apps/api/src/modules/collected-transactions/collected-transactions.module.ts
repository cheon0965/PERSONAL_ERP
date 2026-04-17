import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/public';
import { ReferenceOwnershipPort } from './application/ports/reference-ownership.port';
import { CollectedTransactionStorePort } from './application/ports/collected-transaction-store.port';
import { ConfirmCollectedTransactionStorePort } from './application/ports/confirm-collected-transaction-store.port';
import { DeleteCollectedTransactionUseCase } from './application/use-cases/delete-collected-transaction.use-case';
import { GetCollectedTransactionDetailUseCase } from './application/use-cases/get-collected-transaction-detail.use-case';
import { CreateCollectedTransactionUseCase } from './application/use-cases/create-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from './application/use-cases/list-collected-transactions.use-case';
import { UpdateCollectedTransactionUseCase } from './application/use-cases/update-collected-transaction.use-case';
import { ConfirmCollectedTransactionUseCase } from './confirm-collected-transaction.use-case';
import { PrismaReferenceOwnershipAdapter } from './infrastructure/prisma/prisma-reference-ownership.adapter';
import { PrismaCollectedTransactionStoreAdapter } from './infrastructure/prisma/prisma-collected-transaction-store.adapter';
import { PrismaConfirmCollectedTransactionStoreAdapter } from './infrastructure/prisma/prisma-confirm-collected-transaction-store.adapter';
import { CollectedTransactionsController } from './collected-transactions.controller';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [CollectedTransactionsController],
  providers: [
    PrismaCollectedTransactionStoreAdapter,
    PrismaReferenceOwnershipAdapter,
    PrismaConfirmCollectedTransactionStoreAdapter,
    {
      provide: CollectedTransactionStorePort,
      useExisting: PrismaCollectedTransactionStoreAdapter
    },
    {
      provide: ReferenceOwnershipPort,
      useExisting: PrismaReferenceOwnershipAdapter
    },
    {
      provide: ConfirmCollectedTransactionStorePort,
      useExisting: PrismaConfirmCollectedTransactionStoreAdapter
    },
    {
      provide: ListCollectedTransactionsUseCase,
      useFactory: (collectedTransactionStore: CollectedTransactionStorePort) =>
        new ListCollectedTransactionsUseCase(collectedTransactionStore),
      inject: [CollectedTransactionStorePort]
    },
    {
      provide: GetCollectedTransactionDetailUseCase,
      useFactory: (collectedTransactionStore: CollectedTransactionStorePort) =>
        new GetCollectedTransactionDetailUseCase(collectedTransactionStore),
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
    {
      provide: UpdateCollectedTransactionUseCase,
      useFactory: (
        collectedTransactionStore: CollectedTransactionStorePort,
        referenceOwnership: ReferenceOwnershipPort
      ) =>
        new UpdateCollectedTransactionUseCase(
          collectedTransactionStore,
          referenceOwnership
        ),
      inject: [CollectedTransactionStorePort, ReferenceOwnershipPort]
    },
    {
      provide: DeleteCollectedTransactionUseCase,
      useFactory: (collectedTransactionStore: CollectedTransactionStorePort) =>
        new DeleteCollectedTransactionUseCase(collectedTransactionStore),
      inject: [CollectedTransactionStorePort]
    },
    {
      provide: ConfirmCollectedTransactionUseCase,
      useFactory: (
        confirmStore: ConfirmCollectedTransactionStorePort
      ) => new ConfirmCollectedTransactionUseCase(confirmStore),
      inject: [ConfirmCollectedTransactionStorePort]
    }
  ]
})
export class CollectedTransactionsModule {}
