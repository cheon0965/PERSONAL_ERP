import type { RecurringRuleItem } from '@personal-erp/contracts';
import type { RecurringRuleStorePort } from '../ports/recurring-rule-store.port';
import { mapRecurringRuleToItem } from '../recurring-rule-item.mapper';

export class ListRecurringRulesUseCase {
  constructor(private readonly recurringRuleStore: RecurringRuleStorePort) {}

  async execute(command: {
    tenantId: string;
    ledgerId: string;
  }): Promise<RecurringRuleItem[]> {
    const rules = await this.recurringRuleStore.findAllInWorkspace(
      command.tenantId,
      command.ledgerId
    );
    return rules.map(mapRecurringRuleToItem);
  }
}
