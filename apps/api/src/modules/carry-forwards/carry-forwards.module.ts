import { Module } from '@nestjs/common';
import { GenerateCarryForwardUseCase } from './generate-carry-forward.use-case';
import { CarryForwardsController } from './carry-forwards.controller';
import { CarryForwardsService } from './carry-forwards.service';

@Module({
  controllers: [CarryForwardsController],
  providers: [CarryForwardsService, GenerateCarryForwardUseCase]
})
export class CarryForwardsModule {}
