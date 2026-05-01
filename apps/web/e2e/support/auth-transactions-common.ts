import { expect } from '@playwright/test';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  AuthenticatedWorkspaceListResponse
} from '@personal-erp/contracts';

export const e2eApiRoutePattern = '**/api/**';

export function expectNoPageErrors(pageErrors: string[]) {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
}

export function expectNoUnhandledApiRequests(unhandledApiRequests: string[]) {
  expect(unhandledApiRequests, unhandledApiRequests.join('\n\n')).toEqual([]);
}

export function buildE2EAuthWorkspacesResponse(
  currentUser: AuthenticatedUser
): AuthenticatedWorkspaceListResponse {
  return {
    items: currentUser.currentWorkspace
      ? [
          {
            ...currentUser.currentWorkspace,
            isCurrent: true
          }
        ]
      : []
  };
}

export function buildE2EAccountingPeriod(input: {
  id: string;
  month: string;
  status: AccountingPeriodItem['status'];
  openedAt: string;
  lockedAt: string | null;
  hasOpeningBalanceSnapshot: boolean;
  openingBalanceSourceKind: AccountingPeriodItem['openingBalanceSourceKind'];
  statusHistory: AccountingPeriodItem['statusHistory'];
}): AccountingPeriodItem {
  const [yearToken, monthToken] = input.month.split('-');
  const year = Number(yearToken);
  const month = Number(monthToken);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    id: input.id,
    year,
    month,
    monthLabel: input.month,
    startDate: `${input.month}-01T00:00:00.000Z`,
    endDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`,
    status: input.status,
    openedAt: input.openedAt,
    lockedAt: input.lockedAt,
    hasOpeningBalanceSnapshot: input.hasOpeningBalanceSnapshot,
    openingBalanceSourceKind: input.openingBalanceSourceKind,
    statusHistory: input.statusHistory
  };
}
