import type { InsurancePolicyRecord } from '../../insurance-policies.mapper';
import type {
  InsurancePolicyRecurringReferenceState,
  NormalizedInsurancePolicyInput
} from '../../insurance-policy.write-model';

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
