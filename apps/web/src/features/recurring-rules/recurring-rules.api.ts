import type {
  CreateRecurringRuleRequest,
  RecurringRuleItem
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export const recurringRulesQueryKey = ['recurring-rules'] as const;

export const mockRecurringRules: RecurringRuleItem[] = [
  {
    id: 'rr-1',
    title: '휴대폰 요금',
    amountWon: 75000,
    frequency: 'MONTHLY',
    nextRunDate: '2026-04-10',
    fundingAccountName: '주거래 통장',
    categoryName: '통신비',
    isActive: true
  },
  {
    id: 'rr-2',
    title: '차량 할부금',
    amountWon: 280000,
    frequency: 'MONTHLY',
    nextRunDate: '2026-04-03',
    fundingAccountName: '주거래 통장',
    categoryName: '차량비',
    isActive: true
  }
];

export function getRecurringRules() {
  return fetchJson<RecurringRuleItem[]>('/recurring-rules', mockRecurringRules);
}

export function createRecurringRule(
  input: CreateRecurringRuleRequest,
  fallback: RecurringRuleItem
) {
  return postJson<RecurringRuleItem, CreateRecurringRuleRequest>(
    '/recurring-rules',
    input,
    fallback
  );
}

export function buildRecurringRuleFallbackItem(
  input: CreateRecurringRuleRequest,
  context: {
    fundingAccountName: string;
    categoryName?: string;
  }
): RecurringRuleItem {
  return {
    id: `rr-demo-${Date.now()}`,
    title: input.title,
    amountWon: input.amountWon,
    frequency: input.frequency,
    nextRunDate: input.startDate,
    fundingAccountName: context.fundingAccountName,
    categoryName: context.categoryName ?? '-',
    isActive: input.isActive ?? true
  };
}

export function mergeRecurringRuleItem(
  current: RecurringRuleItem[] | undefined,
  created: RecurringRuleItem
): RecurringRuleItem[] {
  const nextItems = [
    created,
    ...(current ?? []).filter((item) => item.id !== created.id)
  ];

  return nextItems.sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return Number(right.isActive) - Number(left.isActive);
    }

    return (left.nextRunDate ?? '9999-12-31').localeCompare(
      right.nextRunDate ?? '9999-12-31'
    );
  });
}
