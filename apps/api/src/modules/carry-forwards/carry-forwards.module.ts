import { Module } from '@nestjs/common';
import { CarryForwardsController } from './carry-forwards.controller';
import { CarryForwardsService } from './carry-forwards.service';

@Module({
  controllers: [CarryForwardsController],
  providers: [CarryForwardsService]
})
export class CarryForwardsModule {}
