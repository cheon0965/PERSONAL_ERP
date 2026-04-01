import { Injectable } from '@nestjs/common';
import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { mapInsurancePolicyToItem } from './insurance-policies.mapper';
import { InsurancePoliciesRepository } from './insurance-policies.repository';

@Injectable()
export class InsurancePoliciesService {
  constructor(
    private readonly insurancePoliciesRepository: InsurancePoliciesRepository
  ) {}

  async findAll(userId: string): Promise<InsurancePolicyItem[]> {
    const items =
      await this.insurancePoliciesRepository.findActiveByUserId(userId);
    return items.map(mapInsurancePolicyToItem);
  }
}
