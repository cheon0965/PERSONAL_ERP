import { Module } from '@nestjs/common';
import { CreateInsurancePolicyUseCase } from './application/use-cases/create-insurance-policy.use-case';
import { DeleteInsurancePolicyUseCase } from './application/use-cases/delete-insurance-policy.use-case';
import { UpdateInsurancePolicyUseCase } from './application/use-cases/update-insurance-policy.use-case';
import { InsurancePolicyWritePort } from './application/ports/insurance-policy-write.port';
import { PrismaInsurancePolicyWriteAdapter } from './infrastructure/prisma/prisma-insurance-policy-write.adapter';
import { InsurancePoliciesController } from './insurance-policies.controller';
import { InsurancePolicyQueryService } from './insurance-policy-query.service';
import { InsurancePoliciesRepository } from './insurance-policies.repository';

@Module({
  controllers: [InsurancePoliciesController],
  providers: [
    InsurancePoliciesRepository,
    InsurancePolicyQueryService,
    CreateInsurancePolicyUseCase,
    UpdateInsurancePolicyUseCase,
    DeleteInsurancePolicyUseCase,
    PrismaInsurancePolicyWriteAdapter,
    {
      provide: InsurancePolicyWritePort,
      useExisting: PrismaInsurancePolicyWriteAdapter
    }
  ]
})
export class InsurancePoliciesModule {}
