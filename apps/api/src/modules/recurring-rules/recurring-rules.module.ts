import { Module } from '@nestjs/common';
import { RecurringRuleStorePort } from './application/ports/recurring-rule-store.port';
import { ReferenceOwnershipPort } from './application/ports/reference-ownership.port';
import { DeleteRecurringRuleUseCase } from './application/use-cases/delete-recurring-rule.use-case';
import { GetRecurringRuleDetailUseCase } from './application/use-cases/get-recurring-rule-detail.use-case';
import { CreateRecurringRuleUseCase } from './application/use-cases/create-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from './application/use-cases/list-recurring-rules.use-case';
import { UpdateRecurringRuleUseCase } from './application/use-cases/update-recurring-rule.use-case';
import { PrismaRecurringRuleStoreAdapter } from './infrastructure/prisma/prisma-recurring-rule-store.adapter';
import { PrismaReferenceOwnershipAdapter } from './infrastructure/prisma/prisma-reference-ownership.adapter';
import { RecurringRulesController } from './recurring-rules.controller';

@Module({
  controllers: [RecurringRulesController],
  providers: [
    PrismaRecurringRuleStoreAdapter,
    PrismaReferenceOwnershipAdapter,
    {
      provide: RecurringRuleStorePort,
      useExisting: PrismaRecurringRuleStoreAdapter
    },
    {
      provide: ReferenceOwnershipPort,
      useExisting: PrismaReferenceOwnershipAdapter
    },
    {
      provide: ListRecurringRulesUseCase,
      useFactory: (recurringRuleStore: RecurringRuleStorePort) =>
        new ListRecurringRulesUseCase(recurringRuleStore),
      inject: [RecurringRuleStorePort]
    },
    {
      provide: GetRecurringRuleDetailUseCase,
      useFactory: (recurringRuleStore: RecurringRuleStorePort) =>
        new GetRecurringRuleDetailUseCase(recurringRuleStore),
      inject: [RecurringRuleStorePort]
    },
    {
      provide: CreateRecurringRuleUseCase,
      useFactory: (
        recurringRuleStore: RecurringRuleStorePort,
        referenceOwnership: ReferenceOwnershipPort
      ) =>
        new CreateRecurringRuleUseCase(recurringRuleStore, referenceOwnership),
      inject: [RecurringRuleStorePort, ReferenceOwnershipPort]
    },
    {
      provide: UpdateRecurringRuleUseCase,
      useFactory: (
        recurringRuleStore: RecurringRuleStorePort,
        referenceOwnership: ReferenceOwnershipPort
      ) =>
        new UpdateRecurringRuleUseCase(recurringRuleStore, referenceOwnership),
      inject: [RecurringRuleStorePort, ReferenceOwnershipPort]
    },
    {
      provide: DeleteRecurringRuleUseCase,
      useFactory: (recurringRuleStore: RecurringRuleStorePort) =>
        new DeleteRecurringRuleUseCase(recurringRuleStore),
      inject: [RecurringRuleStorePort]
    }
  ]
})
export class RecurringRulesModule {}