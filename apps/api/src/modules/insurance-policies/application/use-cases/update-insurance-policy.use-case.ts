import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  InsurancePolicyItem,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { mapInsurancePolicyToItem } from '../../insurance-policies.mapper';
import { InsurancePoliciesRepository } from '../../insurance-policies.repository';
import {
  assertInsurancePolicyRecurringReferences,
  assertInsurancePolicyUnique,
  normalizeInsurancePolicyInput
} from '../../insurance-policy.write-model';
import { InsurancePolicyWritePort } from '../ports/insurance-policy-write.port';

@Injectable()
export class UpdateInsurancePolicyUseCase {
  constructor(
    private readonly insurancePoliciesRepository: InsurancePoliciesRepository,
    @Inject(InsurancePolicyWritePort)
    private readonly insurancePolicyWritePort: InsurancePolicyWritePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    insurancePolicyId: string,
    input: UpdateInsurancePolicyRequest
  ): Promise<InsurancePolicyItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.insurancePoliciesRepository.findByIdInWorkspace(
      insurancePolicyId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return null;
    }

    const normalizedInput = normalizeInsurancePolicyInput(input);
    const duplicate = await this.insurancePoliciesRepository.findDuplicateInWorkspace(
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
