import { Module } from '@nestjs/common';
import { GeneratePlanItemsUseCase } from './generate-plan-items.use-case';
import { PlanItemsController } from './plan-items.controller';
import { PlanItemsService } from './plan-items.service';

@Module({
  controllers: [PlanItemsController],
  providers: [PlanItemsService, GeneratePlanItemsUseCase]
})
export class PlanItemsModule {}
