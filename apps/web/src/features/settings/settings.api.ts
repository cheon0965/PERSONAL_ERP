import type {
  AccountProfileItem,
  AccountSecurityOverview,
  ChangePasswordRequest,
  ChangePasswordResponse,
  RevokeAccountSessionResponse,
  UpdateAccountProfileRequest,
  UpdateWorkspaceSettingsRequest,
  WorkspaceSettingsItem
} from '@personal-erp/contracts';
import {
  deleteJson,
  fetchJson,
  patchJson,
  postJson
} from '../../shared/api/fetch-json';

export const workspaceSettingsQueryKey = ['settings', 'workspace'] as const;
export const accountSecurityQueryKey = ['settings', 'account-security'] as const;

export function getWorkspaceSettings() {
  return fetchJson<WorkspaceSettingsItem>('/settings/workspace', {
    tenant: {
      id: 'fallback-tenant',
      name: '데모 사업장',
      slug: 'demo-workspace',
      status: 'ACTIVE'
    },
    ledger: {
      id: 'fallback-ledger',
      name: '기본 장부',
      baseCurrency: 'KRW',
      timezone: 'Asia/Seoul',
      status: 'ACTIVE',
      openedFromYearMonth: '2026-01',
      closedThroughYearMonth: null
    },
    membershipRole: 'OWNER',
    canManage: true
  });
}

export function updateWorkspaceSettings(
  input: UpdateWorkspaceSettingsRequest,
  fallback: WorkspaceSettingsItem
) {
  return patchJson<WorkspaceSettingsItem, UpdateWorkspaceSettingsRequest>(
    '/settings/workspace',
    input,
    {
      ...fallback,
      tenant: {
        ...fallback.tenant,
        name: input.tenantName,
        slug: input.tenantSlug,
        status: input.tenantStatus
      },
      ledger: {
        ...fallback.ledger,
        name: input.ledgerName,
        baseCurrency: input.baseCurrency,
        timezone: input.timezone
      }
    }
  );
}

export function getAccountSecurityOverview() {
  return fetchJson<AccountSecurityOverview>('/auth/account-security', {
    profile: {
      id: 'fallback-user',
      email: 'demo@example.com',
      name: '데모 사용자',
      emailVerifiedAt: new Date().toISOString(),
      preferredTimezone: 'Asia/Seoul'
    },
    sessions: [],
    recentEvents: []
  });
}

export function updateAccountProfile(
  input: UpdateAccountProfileRequest,
  fallback: AccountProfileItem
) {
  return patchJson<AccountProfileItem, UpdateAccountProfileRequest>(
    '/auth/account-profile',
    input,
    {
      ...fallback,
      name: input.name
    }
  );
}

export function changePassword(input: ChangePasswordRequest) {
  return postJson<ChangePasswordResponse, ChangePasswordRequest>(
    '/auth/change-password',
    input,
    {
      status: 'changed'
    }
  );
}

export function revokeAccountSession(sessionId: string) {
  return deleteJson<RevokeAccountSessionResponse>(
    `/auth/sessions/${sessionId}`,
    {
      status: 'revoked'
    }
  );
}
