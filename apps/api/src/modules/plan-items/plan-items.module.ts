import { Module } from '@nestjs/common';
import { PlanItemGenerationPort } from './application/ports/plan-item-generation.port';
import { PlanItemViewPort } from './application/ports/plan-item-view.port';
import { GeneratePlanItemsUseCase } from './application/use-cases/generate-plan-items.use-case';
import { PrismaPlanItemGenerationAdapter } from './infrastructure/prisma/prisma-plan-item-generation.adapter';
import { PlanItemsController } from './plan-items.controller';
import { PlanItemsService } from './infrastructure/services/plan-items.service';

@Module({
  controllers: [PlanItemsController],
  providers: [
    PlanItemsService,
    GeneratePlanItemsUseCase,
    PrismaPlanItemGenerationAdapter,
    {
      provide: PlanItemGenerationPort,
      useExisting: PrismaPlanItemGenerationAdapter
    },
    {
      provide: PlanItemViewPort,
      useExisting: PlanItemsService
    }
  ]
})
export class PlanItemsModule {}
