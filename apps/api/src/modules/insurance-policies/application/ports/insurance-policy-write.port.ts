import type { InsurancePolicyRecord } from '../mappers/insurance-policies.mapper';
import type {
  InsurancePolicyRecurringReferenceState,
  NormalizedInsurancePolicyInput
} from '../policies/insurance-policy.policy';

export type InsurancePolicyReferenceStateInput = {
  tenantId: string;
  ledgerId: string;
  fundingAccountId: string;
  categoryId: string;
};

export type CreateInsurancePolicyCommand = {
  userId: string;
  tenantId: string;
  ledgerId: string;
  input: NormalizedInsurancePolicyInput;
};

export type UpdateInsurancePolicyCommand = CreateInsurancePolicyCommand & {
  insurancePolicyId: string;
  existingLinkedRecurringRuleId?: string | null;
};

export type DeleteInsurancePolicyCommand = {
  insurancePolicyId: string;
  tenantId: string;
  ledgerId: string;
  linkedRecurringRuleId?: string | null;
};

export abstract class InsurancePolicyWritePort {
  abstract findByIdInWorkspace(
    insurancePolicyId: string,
    tenantId: string,
    ledgerId: string
  ): Promise<InsurancePolicyRecord | null>;

  abstract findDuplicateInWorkspace(
    tenantId: string,
    ledgerId: string,
    provider: string,
    productName: string,
    excludeInsurancePolicyId?: string
  ): Promise<{ id: string; isActive: boolean } | null>;

  abstract readRecurringReferenceState(
    input: InsurancePolicyReferenceStateInput
  ): Promise<InsurancePolicyRecurringReferenceState>;

  abstract createPolicy(
    input: CreateInsurancePolicyCommand
  ): Promise<InsurancePolicyRecord>;

  abstract updatePolicy(
    input: UpdateInsurancePolicyCommand
  ): Promise<InsurancePolicyRecord>;

  abstract deletePolicy(input: DeleteInsurancePolicyCommand): Promise<boolean>;
}
