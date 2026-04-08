import type {
  CreateRecurringRuleRequest,
  RecurringRuleDetailItem,
  RecurringRuleItem,
  UpdateRecurringRuleRequest
} from '@personal-erp/contracts';
import {
  deleteJson,
  fetchJson,
  patchJson,
  postJson
} from '@/shared/api/fetch-json';

export const recurringRulesQueryKey = ['recurring-rules'] as const;

export const recurringRuleDetailQueryKey = (recurringRuleId: string) =>
  ['recurring-rules', recurringRuleId] as const;

export type ManagedRecurringRuleItem = RecurringRuleItem & {
  linkedInsurancePolicyId: string | null;
};

export type ManagedRecurringRuleDetailItem = RecurringRuleDetailItem & {
  linkedInsurancePolicyId: string | null;
};

export const mockRecurringRules: ManagedRecurringRuleItem[] = [
  {
    id: 'rr-1',
    title: 'POS/인터넷 요금',
    amountWon: 75000,
    frequency: 'MONTHLY',
    nextRunDate: '2026-04-10',
    linkedInsurancePolicyId: null,
    fundingAccountName: '사업 운영 통장',
    categoryName: '통신·POS 비용',
    isActive: true
  },
  {
    id: 'rr-ins-1',
    title: '삼성화재 업무용 차량 보험',
    amountWon: 98000,
    frequency: 'MONTHLY',
    nextRunDate: '2026-04-25',
    linkedInsurancePolicyId: 'ins-1',
    fundingAccountName: '사업 운영 통장',
    categoryName: '사업 보험료',
    isActive: true
  }
];

const mockRecurringRuleDetails: Record<string, ManagedRecurringRuleDetailItem> =
  {
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
      linkedInsurancePolicyId: null,
      isActive: true
    },
    'rr-ins-1': {
      id: 'rr-ins-1',
      title: '삼성화재 업무용 차량 보험',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-3',
      amountWon: 98000,
      frequency: 'MONTHLY',
      dayOfMonth: 25,
      startDate: '2026-04-25',
      endDate: null,
      nextRunDate: '2026-04-25',
      linkedInsurancePolicyId: 'ins-1',
      isActive: true
    }
  };

export function getRecurringRules() {
  return fetchJson<ManagedRecurringRuleItem[]>(
    '/recurring-rules',
    mockRecurringRules
  );
}

export function getRecurringRuleDetail(recurringRuleId: string) {
  return fetchJson<ManagedRecurringRuleDetailItem>(
    `/recurring-rules/${recurringRuleId}`,
    resolveRecurringRuleDetailFallback(recurringRuleId)
  );
}

export function createRecurringRule(
  input: CreateRecurringRuleRequest,
  fallback: ManagedRecurringRuleItem
) {
  return postJson<ManagedRecurringRuleItem, CreateRecurringRuleRequest>(
    '/recurring-rules',
    input,
    fallback
  );
}

export function updateRecurringRule(
  recurringRuleId: string,
  input: UpdateRecurringRuleRequest,
  fallback: ManagedRecurringRuleItem
) {
  return patchJson<ManagedRecurringRuleItem, UpdateRecurringRuleRequest>(
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
    linkedInsurancePolicyId?: string | null;
  }
): ManagedRecurringRuleItem {
  return {
    id: context.id ?? `rr-demo-${Date.now()}`,
    title: input.title,
    amountWon: input.amountWon,
    frequency: input.frequency,
    nextRunDate: context.nextRunDate ?? input.startDate,
    linkedInsurancePolicyId: context.linkedInsurancePolicyId ?? null,
    fundingAccountName: context.fundingAccountName,
    categoryName: context.categoryName ?? '-',
    isActive: context.isActive ?? input.isActive ?? true
  };
}

export function mergeRecurringRuleItem(
  current: ManagedRecurringRuleItem[] | undefined,
  created: ManagedRecurringRuleItem
): ManagedRecurringRuleItem[] {
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
  current: ManagedRecurringRuleItem[] | undefined,
  recurringRuleId: string
): ManagedRecurringRuleItem[] {
  return (current ?? []).filter((item) => item.id !== recurringRuleId);
}

function resolveRecurringRuleDetailFallback(
  recurringRuleId: string
): ManagedRecurringRuleDetailItem {
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
    linkedInsurancePolicyId: base?.linkedInsurancePolicyId ?? null,
    isActive: base?.isActive ?? true
  };
}
