import type {
  AccountingPeriodItem,
  CloseAccountingPeriodRequest,
  CloseAccountingPeriodResponse,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export const accountingPeriodsQueryKey = ['accounting-periods'] as const;
export const currentAccountingPeriodQueryKey = ['accounting-periods', 'current'] as const;

export function getAccountingPeriods() {
  return fetchJson<AccountingPeriodItem[]>('/accounting-periods', []);
}

export function getCurrentAccountingPeriod() {
  return fetchJson<AccountingPeriodItem | null>('/accounting-periods/current', null);
}

export function openAccountingPeriod(input: OpenAccountingPeriodRequest) {
  return postJson<AccountingPeriodItem, OpenAccountingPeriodRequest>(
    '/accounting-periods',
    input,
    buildAccountingPeriodFallbackItem(input)
  );
}

export function closeAccountingPeriod(
  periodId: string,
  input: CloseAccountingPeriodRequest,
  fallback: CloseAccountingPeriodResponse
) {
  return postJson<CloseAccountingPeriodResponse, CloseAccountingPeriodRequest>(
    `/accounting-periods/${periodId}/close`,
    input,
    fallback
  );
}

function buildAccountingPeriodFallbackItem(
  input: OpenAccountingPeriodRequest
): AccountingPeriodItem {
  const [yearToken, monthToken] = input.month.split('-');
  const year = Number(yearToken);
  const month = Number(monthToken);
  const startDate = `${input.month}-01T00:00:00.000Z`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01T00:00:00.000Z`
      : `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00.000Z`;

  return {
    id: `period-demo-${Date.now()}`,
    year,
    month,
    monthLabel: input.month,
    startDate,
    endDate,
    status: 'OPEN',
    openedAt: new Date().toISOString(),
    lockedAt: null,
    hasOpeningBalanceSnapshot: Boolean(input.initializeOpeningBalance),
    openingBalanceSourceKind: input.initializeOpeningBalance
      ? 'INITIAL_SETUP'
      : null,
    statusHistory: [
      {
        id: `period-history-demo-${Date.now()}`,
        fromStatus: null,
        toStatus: 'OPEN',
        reason: input.note?.trim() || null,
        actorType: 'TENANT_MEMBERSHIP',
        actorMembershipId: null,
        changedAt: new Date().toISOString()
      }
    ]
  };
}

export function buildCloseAccountingPeriodFallback(
  period: AccountingPeriodItem,
  input: CloseAccountingPeriodRequest
): CloseAccountingPeriodResponse {
  const lockedAt = new Date().toISOString();

  return {
    period: {
      ...period,
      status: 'LOCKED',
      lockedAt,
      statusHistory: [
        {
          id: `period-history-demo-close-${Date.now()}`,
          fromStatus: period.status,
          toStatus: 'LOCKED',
          reason: input.note?.trim() || null,
          actorType: 'TENANT_MEMBERSHIP',
          actorMembershipId: null,
          changedAt: lockedAt
        },
        ...period.statusHistory
      ]
    },
    closingSnapshot: {
      id: `closing-snapshot-demo-${Date.now()}`,
      periodId: period.id,
      lockedAt,
      totalAssetAmount: 0,
      totalLiabilityAmount: 0,
      totalEquityAmount: 0,
      periodPnLAmount: 0,
      lines: []
    }
  };
}
