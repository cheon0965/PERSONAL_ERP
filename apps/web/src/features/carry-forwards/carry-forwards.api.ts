import type {
  AccountingPeriodItem,
  CarryForwardView,
  GenerateCarryForwardRequest
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export function carryForwardQueryKey(fromPeriodId?: string | null) {
  return ['carry-forwards', fromPeriodId ?? 'none'] as const;
}

export function getCarryForwardView(fromPeriodId?: string | null) {
  const query = fromPeriodId
    ? `?fromPeriodId=${encodeURIComponent(fromPeriodId)}`
    : '';
  return fetchJson<CarryForwardView | null>(`/carry-forwards${query}`, null);
}

export function generateCarryForward(
  payload: GenerateCarryForwardRequest,
  fallback: CarryForwardView
) {
  return postJson<CarryForwardView, GenerateCarryForwardRequest>(
    '/carry-forwards/generate',
    payload,
    fallback
  );
}

export function buildCarryForwardFallback(
  sourcePeriod: AccountingPeriodItem
): CarryForwardView {
  const target = readNextPeriod(sourcePeriod);
  const createdAt = new Date().toISOString();

  return {
    carryForwardRecord: {
      id: `carry-forward-demo-${Date.now()}`,
      fromPeriodId: sourcePeriod.id,
      toPeriodId: `${sourcePeriod.id}-next`,
      sourceClosingSnapshotId: `closing-demo-${sourcePeriod.id}`,
      createdJournalEntryId: null,
      createdAt,
      createdByActorType: 'TENANT_MEMBERSHIP',
      createdByMembershipId: null
    },
    sourcePeriod,
    sourceClosingSnapshot: {
      id: `closing-demo-${sourcePeriod.id}`,
      periodId: sourcePeriod.id,
      lockedAt: createdAt,
      totalAssetAmount: 0,
      totalLiabilityAmount: 0,
      totalEquityAmount: 0,
      periodPnLAmount: 0,
      lines: []
    },
    targetPeriod: {
      id: `${sourcePeriod.id}-next`,
      year: target.year,
      month: target.month,
      monthLabel: target.monthLabel,
      startDate: `${target.monthLabel}-01T00:00:00.000Z`,
      endDate:
        target.month === 12
          ? `${target.year + 1}-01-01T00:00:00.000Z`
          : `${target.year}-${String(target.month + 1).padStart(2, '0')}-01T00:00:00.000Z`,
      status: 'OPEN',
      openedAt: createdAt,
      lockedAt: null,
      hasOpeningBalanceSnapshot: true,
      openingBalanceSourceKind: 'CARRY_FORWARD',
      statusHistory: []
    },
    targetOpeningBalanceSnapshot: {
      id: `opening-demo-${sourcePeriod.id}`,
      effectivePeriodId: `${sourcePeriod.id}-next`,
      sourceKind: 'CARRY_FORWARD',
      createdAt,
      lines: []
    }
  };
}

function readNextPeriod(sourcePeriod: AccountingPeriodItem) {
  const year =
    sourcePeriod.month === 12 ? sourcePeriod.year + 1 : sourcePeriod.year;
  const month = sourcePeriod.month === 12 ? 1 : sourcePeriod.month + 1;

  return {
    year,
    month,
    monthLabel: `${year}-${String(month).padStart(2, '0')}`
  };
}
