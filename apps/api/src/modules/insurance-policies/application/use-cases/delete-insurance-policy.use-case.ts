import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { InsurancePoliciesRepository } from '../../insurance-policies.repository';
import { InsurancePolicyWritePort } from '../ports/insurance-policy-write.port';

@Injectable()
export class DeleteInsurancePolicyUseCase {
  constructor(
    private readonly insurancePoliciesRepository: InsurancePoliciesRepository,
    @Inject(InsurancePolicyWritePort)
    private readonly insurancePolicyWritePort: InsurancePolicyWritePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    insurancePolicyId: string
  ): Promise<boolean> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.insurancePoliciesRepository.findByIdInWorkspace(
      insurancePolicyId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return false;
    }

    return this.insurancePolicyWritePort.deletePolicy({
      insurancePolicyId,
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      linkedRecurringRuleId: existing.linkedRecurringRuleId
    });
  }
}
