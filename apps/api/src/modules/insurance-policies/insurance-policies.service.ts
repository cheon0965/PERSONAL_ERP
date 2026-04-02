import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  InsurancePolicyItem
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { mapInsurancePolicyToItem } from './insurance-policies.mapper';
import { InsurancePoliciesRepository } from './insurance-policies.repository';

@Injectable()
export class InsurancePoliciesService {
  constructor(
    private readonly insurancePoliciesRepository: InsurancePoliciesRepository
  ) {}

  async findAll(user: AuthenticatedUser): Promise<InsurancePolicyItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const items =
      await this.insurancePoliciesRepository.findActiveInWorkspace(
        workspace.tenantId,
        workspace.ledgerId
      );
    return items.map(mapInsurancePolicyToItem);
  }
}
