import { Module } from '@nestjs/common';
import { InsurancePoliciesController } from './insurance-policies.controller';
import { InsurancePoliciesRepository } from './insurance-policies.repository';
import { InsurancePoliciesService } from './insurance-policies.service';

@Module({
  controllers: [InsurancePoliciesController],
  providers: [InsurancePoliciesService, InsurancePoliciesRepository]
})
export class InsurancePoliciesModule {}
