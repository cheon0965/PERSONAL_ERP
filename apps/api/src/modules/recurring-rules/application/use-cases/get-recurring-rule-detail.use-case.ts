import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { RecurringRuleDetailItem } from '@personal-erp/contracts';
import { mapRecurringRuleToDetailItem } from '../recurring-rule-item.mapper';
import type { RecurringRuleStorePort } from '../ports/recurring-rule-store.port';

@ApplicationService()
export class GetRecurringRuleDetailUseCase {
  constructor(private readonly recurringRuleStore: RecurringRuleStorePort) {}

  async execute(input: {
    tenantId: string;
    ledgerId: string;
    recurringRuleId: string;
  }): Promise<RecurringRuleDetailItem | null> {
    const rule = await this.recurringRuleStore.findByIdInWorkspace(
      input.tenantId,
      input.ledgerId,
      input.recurringRuleId
    );

    return rule ? mapRecurringRuleToDetailItem(rule) : null;
  }
}
