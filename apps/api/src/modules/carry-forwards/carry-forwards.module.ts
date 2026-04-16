import { Module } from '@nestjs/common';
import { CarryForwardGenerationPort } from './application/ports/carry-forward-generation.port';
import { GenerateCarryForwardUseCase } from './generate-carry-forward.use-case';
import { CarryForwardsController } from './carry-forwards.controller';
import { CarryForwardsService } from './carry-forwards.service';
import { PrismaCarryForwardGenerationAdapter } from './infrastructure/prisma/prisma-carry-forward-generation.adapter';

@Module({
  controllers: [CarryForwardsController],
  providers: [
    CarryForwardsService,
    GenerateCarryForwardUseCase,
    PrismaCarryForwardGenerationAdapter,
    {
      provide: CarryForwardGenerationPort,
      useExisting: PrismaCarryForwardGenerationAdapter
    }
  ]
})
export class CarryForwardsModule {}
