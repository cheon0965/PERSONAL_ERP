import { Module } from '@nestjs/common';
import { CarryForwardGenerationPort } from './application/ports/carry-forward-generation.port';
import { CarryForwardCancellationPort } from './application/ports/carry-forward-cancellation.port';
import { CarryForwardViewPort } from './application/ports/carry-forward-view.port';
import { CancelCarryForwardUseCase } from './application/use-cases/cancel-carry-forward.use-case';
import { GenerateCarryForwardUseCase } from './application/use-cases/generate-carry-forward.use-case';
import { CarryForwardsController } from './carry-forwards.controller';
import { CarryForwardsService } from './infrastructure/services/carry-forwards.service';
import { PrismaCarryForwardGenerationAdapter } from './infrastructure/prisma/prisma-carry-forward-generation.adapter';
import { PrismaCarryForwardCancellationAdapter } from './infrastructure/prisma/prisma-carry-forward-cancellation.adapter';

@Module({
  controllers: [CarryForwardsController],
  providers: [
    CarryForwardsService,
    PrismaCarryForwardGenerationAdapter,
    PrismaCarryForwardCancellationAdapter,
    {
      provide: CarryForwardGenerationPort,
      useExisting: PrismaCarryForwardGenerationAdapter
    },
    {
      provide: CarryForwardCancellationPort,
      useExisting: PrismaCarryForwardCancellationAdapter
    },
    {
      provide: CarryForwardViewPort,
      useExisting: CarryForwardsService
    },
    CancelCarryForwardUseCase,
    GenerateCarryForwardUseCase
  ]
})
export class CarryForwardsModule {}
