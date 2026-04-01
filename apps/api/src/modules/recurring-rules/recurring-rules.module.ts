import { Module } from '@nestjs/common';
import { RecurringRuleStorePort } from './application/ports/recurring-rule-store.port';
import { ReferenceOwnershipPort } from './application/ports/reference-ownership.port';
import { CreateRecurringRuleUseCase } from './application/use-cases/create-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from './application/use-cases/list-recurring-rules.use-case';
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
      provide: CreateRecurringRuleUseCase,
      useFactory: (
        recurringRuleStore: RecurringRuleStorePort,
        referenceOwnership: ReferenceOwnershipPort
      ) =>
        new CreateRecurringRuleUseCase(recurringRuleStore, referenceOwnership),
      inject: [RecurringRuleStorePort, ReferenceOwnershipPort]
    }
  ]
})
export class RecurringRulesModule {}
