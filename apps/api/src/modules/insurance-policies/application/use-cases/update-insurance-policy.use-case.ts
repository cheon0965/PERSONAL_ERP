import { ApplicationService } from '../../../../common/application/application-service.decorator';

import type {
  AuthenticatedUser,
  InsurancePolicyItem,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { mapInsurancePolicyToItem } from '../mappers/insurance-policies.mapper';
import {
  assertInsurancePolicyRecurringReferences,
  assertInsurancePolicyUnique,
  normalizeInsurancePolicyInput
} from '../policies/insurance-policy.policy';
import { InsurancePolicyWritePort } from '../ports/insurance-policy-write.port';

@ApplicationService()
export class UpdateInsurancePolicyUseCase {
  constructor(
    private readonly insurancePolicyWritePort: InsurancePolicyWritePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    insurancePolicyId: string,
    input: UpdateInsurancePolicyRequest
  ): Promise<InsurancePolicyItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.insurancePolicyWritePort.findByIdInWorkspace(
      insurancePolicyId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return null;
    }

    const normalizedInput = normalizeInsurancePolicyInput(input);
    const duplicate =
      await this.insurancePolicyWritePort.findDuplicateInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        normalizedInput.provider,
        normalizedInput.productName,
        existing.id
      );
    assertInsurancePolicyUnique(duplicate);

    const referenceState =
      await this.insurancePolicyWritePort.readRecurringReferenceState({
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        fundingAccountId: normalizedInput.fundingAccountId,
        categoryId: normalizedInput.categoryId
      });
    assertInsurancePolicyRecurringReferences(referenceState);

    const updated = await this.insurancePolicyWritePort.updatePolicy({
      insurancePolicyId,
      userId: workspace.userId,
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      existingLinkedRecurringRuleId: existing.linkedRecurringRuleId,
      input: normalizedInput
    });

    return mapInsurancePolicyToItem(updated);
  }
}
