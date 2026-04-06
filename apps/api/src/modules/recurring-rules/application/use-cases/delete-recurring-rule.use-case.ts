import { InsuranceManagedRecurringRuleError } from '../../domain/recurring-rule-policy';
import type { RecurringRuleStorePort } from '../ports/recurring-rule-store.port';

export class DeleteRecurringRuleUseCase {
  constructor(private readonly recurringRuleStore: RecurringRuleStorePort) {}

  async execute(input: {
    tenantId: string;
    ledgerId: string;
    recurringRuleId: string;
  }): Promise<boolean> {
    const existing = await this.recurringRuleStore.findByIdInWorkspace(
      input.tenantId,
      input.ledgerId,
      input.recurringRuleId
    );

    if (!existing) {
      return false;
    }

    if (existing.linkedInsurancePolicyId) {
      throw new InsuranceManagedRecurringRuleError(
        existing.linkedInsurancePolicyId
      );
    }

    return this.recurringRuleStore.deleteInWorkspace(
      input.tenantId,
      input.ledgerId,
      input.recurringRuleId
    );
  }
}
