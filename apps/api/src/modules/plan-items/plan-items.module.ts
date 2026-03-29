import { Module } from '@nestjs/common';
import { PlanItemsController } from './plan-items.controller';
import { PlanItemsService } from './plan-items.service';

@Module({
  controllers: [PlanItemsController],
  providers: [PlanItemsService]
})
export class PlanItemsModule {}
