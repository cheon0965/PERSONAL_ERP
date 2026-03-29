'use client';

import type {
  AccountingPeriodItem,
  GeneratePlanItemsRequest,
  GeneratePlanItemsResponse,
  PlanItemsView
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export const planItemsQueryKey = (periodId: string | null) =>
  ['plan-items', periodId] as const;

export function getPlanItems(
  periodId: string | null,
  fallbackPeriod?: AccountingPeriodItem | null
) {
  if (!periodId) {
    return Promise.resolve(null);
  }

  return fetchJson<PlanItemsView | null>(
    `/plan-items?periodId=${encodeURIComponent(periodId)}`,
    fallbackPeriod ? buildPlanItemsFallbackView(fallbackPeriod) : null
  );
}

export function generatePlanItems(
  input: GeneratePlanItemsRequest,
  fallbackPeriod: AccountingPeriodItem
) {
  return postJson<GeneratePlanItemsResponse, GeneratePlanItemsRequest>(
    '/plan-items/generate',
    input,
    buildGeneratedPlanItemsFallbackResponse(fallbackPeriod)
  );
}

export function buildPlanItemsFallbackView(
  period: AccountingPeriodItem
): PlanItemsView {
  return {
    period,
    items: [],
    summary: {
      totalCount: 0,
      totalPlannedAmount: 0,
      draftCount: 0,
      matchedCount: 0,
      confirmedCount: 0,
      skippedCount: 0,
      expiredCount: 0
    }
  };
}

function buildGeneratedPlanItemsFallbackResponse(
  period: AccountingPeriodItem
): GeneratePlanItemsResponse {
  return {
    ...buildPlanItemsFallbackView(period),
    generation: {
      createdCount: 0,
      skippedExistingCount: 0,
      excludedRuleCount: 0
    }
  };
}
