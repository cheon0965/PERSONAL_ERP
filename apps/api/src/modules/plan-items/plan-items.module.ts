import { Module } from '@nestjs/common';
import { PlanItemGenerationPort } from './application/ports/plan-item-generation.port';
import { GeneratePlanItemsUseCase } from './generate-plan-items.use-case';
import { PrismaPlanItemGenerationAdapter } from './infrastructure/prisma/prisma-plan-item-generation.adapter';
import { PlanItemsController } from './plan-items.controller';
import { PlanItemsService } from './plan-items.service';

@Module({
  controllers: [PlanItemsController],
  providers: [
    PlanItemsService,
    GeneratePlanItemsUseCase,
    PrismaPlanItemGenerationAdapter,
    {
      provide: PlanItemGenerationPort,
      useExisting: PrismaPlanItemGenerationAdapter
    }
  ]
})
export class PlanItemsModule {}
