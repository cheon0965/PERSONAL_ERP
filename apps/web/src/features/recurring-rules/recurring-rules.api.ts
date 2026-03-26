import type { RecurringRuleItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockRecurringRules: RecurringRuleItem[] = [
  {
    id: 'rr-1',
    title: 'Mobile bill',
    amountWon: 75000,
    frequency: 'MONTHLY',
    nextRunDate: '2026-04-10',
    accountName: 'Main checking',
    categoryName: 'Telecom',
    isActive: true
  },
  {
    id: 'rr-2',
    title: 'Car installment',
    amountWon: 280000,
    frequency: 'MONTHLY',
    nextRunDate: '2026-04-03',
    accountName: 'Main checking',
    categoryName: 'Transport',
    isActive: true
  }
];

export function getRecurringRules() {
  return fetchJson<RecurringRuleItem[]>('/recurring-rules', mockRecurringRules);
}
