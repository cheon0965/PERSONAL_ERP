import type { RecurringRuleItem } from '@personal-erp/contracts';
import type { StoredRecurringRule } from './ports/recurring-rule-store.port';

export function mapRecurringRuleToItem(
  rule: StoredRecurringRule
): RecurringRuleItem {
  return {
    id: rule.id,
    title: rule.title,
    amountWon: rule.amountWon,
    frequency: rule.frequency,
    nextRunDate: rule.nextRunDate?.toISOString().slice(0, 10) ?? null,
    accountName: rule.account.name,
    categoryName: rule.category?.name ?? '-',
    isActive: rule.isActive
  };
}
