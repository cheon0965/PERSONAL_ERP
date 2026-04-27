import type {
  CreateInsurancePolicyRequest,
  InsurancePolicyItem,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import {
  deleteJson,
  fetchJson,
  patchJson,
  postJson
} from '@/shared/api/fetch-json';

export const insurancePoliciesQueryKey = ['insurance-policies'] as const;

export const mockInsurancePolicies: InsurancePolicyItem[] = [
  {
    id: 'ins-1',
    provider: '삼성화재',
    productName: '업무용 차량 보험',
    monthlyPremiumWon: 98000,
    paymentDay: 25,
    cycle: 'MONTHLY',
    fundingAccountId: 'acc-1',
    fundingAccountName: '사업 운영 통장',
    categoryId: 'cat-3',
    categoryName: '사업 보험료',
    recurringStartDate: '2026-04-25',
    linkedRecurringRuleId: 'rr-ins-1',
    renewalDate: '2026-11-01',
    maturityDate: null,
    isActive: true
  },
  {
    id: 'ins-2',
    provider: 'DB손해보험',
    productName: '영업배상 책임보험',
    monthlyPremiumWon: 43000,
    paymentDay: 25,
    cycle: 'MONTHLY',
    fundingAccountId: 'acc-1',
    fundingAccountName: '사업 운영 통장',
    categoryId: 'cat-3',
    categoryName: '사업 보험료',
    recurringStartDate: '2026-04-25',
    linkedRecurringRuleId: 'rr-ins-2',
    renewalDate: '2026-09-15',
    maturityDate: null,
    isActive: false
  }
];

export function getInsurancePolicies(input?: { includeInactive?: boolean }) {
  const includeInactive = input?.includeInactive ?? false;

  return fetchJson<InsurancePolicyItem[]>(
    includeInactive
      ? '/insurance-policies?includeInactive=true'
      : '/insurance-policies',
    includeInactive
      ? mockInsurancePolicies
      : mockInsurancePolicies.filter((policy) => policy.isActive)
  );
}

export function createInsurancePolicy(
  input: CreateInsurancePolicyRequest,
  fallback: InsurancePolicyItem
) {
  return postJson<InsurancePolicyItem, CreateInsurancePolicyRequest>(
    '/insurance-policies',
    input,
    fallback
  );
}

export function updateInsurancePolicy(
  insurancePolicyId: string,
  input: UpdateInsurancePolicyRequest,
  fallback: InsurancePolicyItem
) {
  return patchJson<InsurancePolicyItem, UpdateInsurancePolicyRequest>(
    `/insurance-policies/${insurancePolicyId}`,
    input,
    fallback
  );
}

export function deleteInsurancePolicy(insurancePolicyId: string) {
  return deleteJson<null>(`/insurance-policies/${insurancePolicyId}`, null);
}

export function buildInsurancePolicyFallbackItem(
  input: CreateInsurancePolicyRequest | UpdateInsurancePolicyRequest,
  context?: {
    id?: string;
    fundingAccountName?: string | null;
    categoryName?: string | null;
    linkedRecurringRuleId?: string | null;
  }
): InsurancePolicyItem {
  return {
    id: context?.id ?? `insurance-policy-demo-${Date.now()}`,
    provider: input.provider,
    productName: input.productName,
    monthlyPremiumWon: input.monthlyPremiumWon,
    paymentDay: input.paymentDay,
    cycle: input.cycle,
    fundingAccountId: input.fundingAccountId,
    fundingAccountName: context?.fundingAccountName ?? null,
    categoryId: input.categoryId,
    categoryName: context?.categoryName ?? null,
    recurringStartDate: input.recurringStartDate,
    linkedRecurringRuleId:
      context?.linkedRecurringRuleId ?? `rr-insurance-demo-${Date.now()}`,
    renewalDate: input.renewalDate ?? null,
    maturityDate: input.maturityDate ?? null,
    isActive: input.isActive ?? true
  };
}

export function mergeInsurancePolicyItem(
  current: InsurancePolicyItem[] | undefined,
  saved: InsurancePolicyItem
) {
  return [
    saved,
    ...(current ?? []).filter((item) => item.id !== saved.id)
  ].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return Number(right.isActive) - Number(left.isActive);
    }

    const paymentDayDiff = left.paymentDay - right.paymentDay;
    if (paymentDayDiff !== 0) {
      return paymentDayDiff;
    }

    const providerDiff = left.provider.localeCompare(right.provider);
    if (providerDiff !== 0) {
      return providerDiff;
    }

    return left.productName.localeCompare(right.productName);
  });
}

export function removeInsurancePolicyItem(
  current: InsurancePolicyItem[] | undefined,
  insurancePolicyId: string
) {
  return (current ?? []).filter((item) => item.id !== insurancePolicyId);
}
