import { ApplicationService } from '../../../../common/application/application-service.decorator';

import type { AuthenticatedUser } from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { InsurancePolicyWritePort } from '../ports/insurance-policy-write.port';

@ApplicationService()
export class DeleteInsurancePolicyUseCase {
  constructor(
    private readonly insurancePolicyWritePort: InsurancePolicyWritePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    insurancePolicyId: string
  ): Promise<boolean> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.insurancePolicyWritePort.findByIdInWorkspace(
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
