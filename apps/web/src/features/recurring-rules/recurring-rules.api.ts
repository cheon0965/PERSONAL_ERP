import type {
  CreateRecurringRuleRequest,
  RecurringRuleDetailItem,
  RecurringRuleItem,
  UpdateRecurringRuleRequest
} from '@personal-erp/contracts';
import { deleteJson, fetchJson, patchJson, postJson } from '@/shared/api/fetch-json';

export const recurringRulesQueryKey = ['recurring-rules'] as const;

export const recurringRuleDetailQueryKey = (recurringRuleId: string) =>
  ['recurring-rules', recurringRuleId] as const;

export const mockRecurringRules: RecurringRuleItem[] = [
  {
    id: 'rr-1',
    title: 'POS/인터넷 요금',
    amountWon: 75000,
    frequency: 'MONTHLY',
    nextRunDate: '2026-04-10',
    fundingAccountName: '사업 운영 통장',
    categoryName: '통신·POS 비용',
    isActive: true
  },
  {
    id: 'rr-2',
    title: '정기 소모품 보충',
    amountWon: 280000,
    frequency: 'MONTHLY',
    nextRunDate: '2026-04-03',
    fundingAccountName: '사업 운영 통장',
    categoryName: '원재료비',
    isActive: true
  }
];

const mockRecurringRuleDetails: Record<string, RecurringRuleDetailItem> = {
  'rr-1': {
    id: 'rr-1',
    title: 'POS/인터넷 요금',
    fundingAccountId: 'acc-1',
    categoryId: 'cat-5',
    amountWon: 75000,
    frequency: 'MONTHLY',
    dayOfMonth: 10,
    startDate: '2026-04-10',
    endDate: null,
    nextRunDate: '2026-04-10',
    isActive: true
  },
  'rr-2': {
    id: 'rr-2',
    title: '정기 소모품 보충',
    fundingAccountId: 'acc-1',
    categoryId: 'cat-2',
    amountWon: 280000,
    frequency: 'MONTHLY',
    dayOfMonth: 3,
    startDate: '2026-04-03',
    endDate: null,
    nextRunDate: '2026-04-03',
    isActive: true
  }
};

export function getRecurringRules() {
  return fetchJson<RecurringRuleItem[]>('/recurring-rules', mockRecurringRules);
}

export function getRecurringRuleDetail(recurringRuleId: string) {
  return fetchJson<RecurringRuleDetailItem>(
    `/recurring-rules/${recurringRuleId}`,
    resolveRecurringRuleDetailFallback(recurringRuleId)
  );
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

export function updateRecurringRule(
  recurringRuleId: string,
  input: UpdateRecurringRuleRequest,
  fallback: RecurringRuleItem
) {
  return patchJson<RecurringRuleItem, UpdateRecurringRuleRequest>(
    `/recurring-rules/${recurringRuleId}`,
    input,
    fallback
  );
}

export function deleteRecurringRule(recurringRuleId: string) {
  return deleteJson<null>(`/recurring-rules/${recurringRuleId}`, null);
}

export function buildRecurringRuleFallbackItem(
  input: CreateRecurringRuleRequest,
  context: {
    fundingAccountName: string;
    categoryName?: string;
    id?: string;
    nextRunDate?: string | null;
    isActive?: boolean;
  }
): RecurringRuleItem {
  return {
    id: context.id ?? `rr-demo-${Date.now()}`,
    title: input.title,
    amountWon: input.amountWon,
    frequency: input.frequency,
    nextRunDate: context.nextRunDate ?? input.startDate,
    fundingAccountName: context.fundingAccountName,
    categoryName: context.categoryName ?? '-',
    isActive: context.isActive ?? input.isActive ?? true
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

export function removeRecurringRuleItem(
  current: RecurringRuleItem[] | undefined,
  recurringRuleId: string
): RecurringRuleItem[] {
  return (current ?? []).filter((item) => item.id !== recurringRuleId);
}

function resolveRecurringRuleDetailFallback(
  recurringRuleId: string
): RecurringRuleDetailItem {
  const mockDetail = mockRecurringRuleDetails[recurringRuleId];
  if (mockDetail) {
    return mockDetail;
  }

  const base = mockRecurringRules.find((item) => item.id === recurringRuleId);

  return {
    id: recurringRuleId,
    title: base?.title ?? '반복 규칙',
    fundingAccountId: 'acc-1',
    categoryId: null,
    amountWon: base?.amountWon ?? 0,
    frequency: base?.frequency ?? 'MONTHLY',
    dayOfMonth: 1,
    startDate: base?.nextRunDate ?? '2026-04-01',
    endDate: null,
    nextRunDate: base?.nextRunDate ?? '2026-04-01',
    isActive: base?.isActive ?? true
  };
}
