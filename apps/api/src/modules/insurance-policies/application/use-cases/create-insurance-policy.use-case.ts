// eslint-disable-next-line no-restricted-imports
import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateInsurancePolicyRequest,
  InsurancePolicyItem
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
export class CreateInsurancePolicyUseCase {
  constructor(
    private readonly insurancePoliciesRepository: InsurancePoliciesRepository,
    @Inject(InsurancePolicyWritePort)
    private readonly insurancePolicyWritePort: InsurancePolicyWritePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    input: CreateInsurancePolicyRequest
  ): Promise<InsurancePolicyItem> {
    const workspace = requireCurrentWorkspace(user);
    const normalizedInput = normalizeInsurancePolicyInput(input);

    const duplicate = await this.insurancePoliciesRepository.findDuplicateInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      normalizedInput.provider,
      normalizedInput.productName
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

    const created = await this.insurancePolicyWritePort.createPolicy({
      userId: workspace.userId,
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      input: normalizedInput
    });

    return mapInsurancePolicyToItem(created);
  }
}
