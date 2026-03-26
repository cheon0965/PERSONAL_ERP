import type { RecurringRuleItem } from '@personal-erp/contracts';

type RecurringRuleRecord = {
  id: string;
  title: string;
  amountWon: number;
  frequency: RecurringRuleItem['frequency'];
  nextRunDate: Date | null;
  isActive: boolean;
  account: {
    name: string;
  };
  category: {
    name: string;
  } | null;
};

export function mapRecurringRuleToItem(rule: RecurringRuleRecord): RecurringRuleItem {
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
