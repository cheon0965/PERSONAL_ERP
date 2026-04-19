import type {
  AdminAuditEventItem,
  AdminAuditEventListResponse,
  AdminOperationsStatus,
  AdminPolicySummary,
  AdminAuditEventQuery,
  AdminSupportContext,
  AdminTenantDetail,
  AdminMemberItem,
  AdminSecurityThreatEventListResponse,
  AdminSecurityThreatEventQuery,
  AdminTenantItem,
  AdminUserDetail,
  AdminUserItem,
  NavigationMenuTreeResponse,
  InviteTenantMemberRequest,
  TenantMemberInvitationItem,
  RevokeAdminUserSessionsResponse,
  UpdateAdminSupportContextRequest,
  UpdateAdminTenantStatusRequest,
  UpdateAdminUserEmailVerificationRequest,
  UpdateAdminUserStatusRequest,
  UpdateAdminUserSystemAdminRequest,
  UpdateNavigationMenuItemRequest,
  UpdateTenantMemberRoleRequest,
  UpdateTenantMemberStatusRequest
} from '@personal-erp/contracts';
import {
  deleteJson,
  fetchJson,
  patchJson,
  postJson
} from '../../shared/api/fetch-json';

export const adminMembersQueryKey = ['admin', 'members'] as const;
export const adminTenantsQueryKey = ['admin', 'tenants'] as const;
export const adminUsersQueryKey = ['admin', 'users'] as const;
export const adminSupportContextQueryKey = [
  'admin',
  'support-context'
] as const;
export const adminOperationsStatusQueryKey = [
  'admin',
  'operations-status'
] as const;
export const adminAuditEventsQueryKey = ['admin', 'audit-events'] as const;
export const adminSecurityThreatEventsQueryKey = [
  'admin',
  'security-threats'
] as const;
export const adminPolicyQueryKey = ['admin', 'policy'] as const;
export const adminNavigationQueryKey = ['admin', 'navigation'] as const;

export function getAdminMembers() {
  return fetchJson<AdminMemberItem[]>('/admin/members', []);
}

export function getAdminTenants() {
  return fetchJson<AdminTenantItem[]>('/admin/tenants', []);
}

export function getAdminTenant(tenantId: string) {
  return fetchJson<AdminTenantDetail>(`/admin/tenants/${tenantId}`, {
    id: tenantId,
    slug: '',
    name: '',
    status: 'ACTIVE',
    defaultLedgerId: null,
    defaultLedgerName: null,
    ledgerCount: 0,
    memberCount: 0,
    activeMemberCount: 0,
    ownerCount: 0,
    ledgers: [],
    recentAuditEvents: [],
    recentSecurityThreats: []
  });
}

export function updateAdminTenantStatus(
  tenantId: string,
  input: UpdateAdminTenantStatusRequest
) {
  return patchJson<AdminTenantDetail, UpdateAdminTenantStatusRequest>(
    `/admin/tenants/${tenantId}/status`,
    input,
    {
      id: tenantId,
      slug: '',
      name: '',
      status: input.status,
      defaultLedgerId: null,
      defaultLedgerName: null,
      ledgerCount: 0,
      memberCount: 0,
      activeMemberCount: 0,
      ownerCount: 0,
      ledgers: [],
      recentAuditEvents: [],
      recentSecurityThreats: []
    }
  );
}

export function getAdminUsers() {
  return fetchJson<AdminUserItem[]>('/admin/users', []);
}

export function getAdminUser(userId: string) {
  return fetchJson<AdminUserDetail>(`/admin/users/${userId}`, {
    id: userId,
    email: '',
    name: '',
    status: 'ACTIVE',
    lockedReason: null,
    lockedAt: null,
    isSystemAdmin: false,
    emailVerified: false,
    createdAt: new Date().toISOString(),
    sessionCount: 0,
    activeSessionCount: 0,
    membershipCount: 0,
    activeMembershipCount: 0,
    memberships: [],
    sessions: [],
    recentSecurityThreats: []
  });
}

export function updateAdminUserStatus(
  userId: string,
  input: UpdateAdminUserStatusRequest
) {
  return patchJson<AdminUserDetail, UpdateAdminUserStatusRequest>(
    `/admin/users/${userId}/status`,
    input,
    {
      ...createFallbackAdminUserDetail(userId),
      status: input.status,
      lockedReason: input.reason ?? null,
      lockedAt: input.status === 'ACTIVE' ? null : new Date().toISOString()
    }
  );
}

export function revokeAdminUserSessions(userId: string) {
  return postJson<RevokeAdminUserSessionsResponse, Record<string, never>>(
    `/admin/users/${userId}/revoke-sessions`,
    {},
    { revokedCount: 0 }
  );
}

export function updateAdminUserSystemAdmin(
  userId: string,
  input: UpdateAdminUserSystemAdminRequest
) {
  return patchJson<AdminUserDetail, UpdateAdminUserSystemAdminRequest>(
    `/admin/users/${userId}/system-admin`,
    input,
    {
      ...createFallbackAdminUserDetail(userId),
      isSystemAdmin: input.isSystemAdmin
    }
  );
}

export function updateAdminUserEmailVerification(
  userId: string,
  input: UpdateAdminUserEmailVerificationRequest
) {
  return patchJson<AdminUserDetail, UpdateAdminUserEmailVerificationRequest>(
    `/admin/users/${userId}/email-verification`,
    input,
    {
      ...createFallbackAdminUserDetail(userId),
      emailVerified: true
    }
  );
}

export function inviteAdminMember(input: InviteTenantMemberRequest) {
  return postJson<TenantMemberInvitationItem, InviteTenantMemberRequest>(
    '/admin/members/invitations',
    input,
    {
      id: 'fallback-invitation',
      email: input.email,
      role: input.role,
      expiresAt: new Date().toISOString(),
      acceptedAt: null,
      revokedAt: null,
      invitedByMembershipId: 'fallback-membership',
      createdAt: new Date().toISOString()
    }
  );
}

export function updateAdminMemberRole(
  membershipId: string,
  input: UpdateTenantMemberRoleRequest,
  fallback: AdminMemberItem
) {
  return patchJson<AdminMemberItem, UpdateTenantMemberRoleRequest>(
    `/admin/members/${membershipId}/role`,
    input,
    {
      ...fallback,
      role: input.role
    }
  );
}

export function updateAdminMemberStatus(
  membershipId: string,
  input: UpdateTenantMemberStatusRequest,
  fallback: AdminMemberItem
) {
  return patchJson<AdminMemberItem, UpdateTenantMemberStatusRequest>(
    `/admin/members/${membershipId}/status`,
    input,
    {
      ...fallback,
      status: input.status
    }
  );
}

export function removeAdminMember(membershipId: string) {
  return deleteJson<null>(`/admin/members/${membershipId}`, null);
}

export function getAdminAuditEvents(query: AdminAuditEventQuery = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return fetchJson<AdminAuditEventListResponse>(
    queryString ? `/admin/audit-events?${queryString}` : '/admin/audit-events',
    {
      items: [],
      total: 0,
      offset: query.offset ?? 0,
      limit: query.limit ?? 50
    }
  );
}

export function getAdminAuditEvent(auditEventId: string) {
  return fetchJson<AdminAuditEventItem>(`/admin/audit-events/${auditEventId}`, {
    id: auditEventId,
    tenantId: '',
    ledgerId: null,
    actorUserId: null,
    actorMembershipId: null,
    actorRole: null,
    eventCategory: '',
    eventName: '',
    action: null,
    resourceType: null,
    resourceId: null,
    result: 'SUCCESS',
    reason: null,
    requestId: null,
    path: null,
    metadata: null,
    occurredAt: new Date().toISOString()
  });
}

export function getAdminSecurityThreatEvents(
  query: AdminSecurityThreatEventQuery = {}
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return fetchJson<AdminSecurityThreatEventListResponse>(
    queryString
      ? `/admin/security-threats?${queryString}`
      : '/admin/security-threats',
    {
      items: [],
      total: 0,
      offset: query.offset ?? 0,
      limit: query.limit ?? 50
    }
  );
}

export function getAdminSupportContext() {
  return fetchJson<AdminSupportContext>('/admin/support-context', {
    enabled: false,
    tenant: null,
    ledger: null,
    startedAt: null
  });
}

export function updateAdminSupportContext(
  input: UpdateAdminSupportContextRequest
) {
  return postJson<AdminSupportContext, UpdateAdminSupportContextRequest>(
    '/admin/support-context',
    input,
    {
      enabled: false,
      tenant: null,
      ledger: null,
      startedAt: null
    }
  );
}

export function clearAdminSupportContext() {
  return deleteJson<AdminSupportContext>('/admin/support-context', {
    enabled: false,
    tenant: null,
    ledger: null,
    startedAt: null
  });
}

export function getAdminOperationsStatus() {
  return fetchJson<AdminOperationsStatus>('/admin/operations/status', {
    checkedAt: new Date().toISOString(),
    components: [],
    metrics: {
      totalUsers: 0,
      lockedUsers: 0,
      totalTenants: 0,
      activeTenants: 0,
      suspendedTenants: 0,
      highThreats24h: 0,
      failedAuditEvents24h: 0
    },
    recentSecurityThreats: [],
    recentAuditEvents: []
  });
}

export function getAdminPolicySummary() {
  return fetchJson<AdminPolicySummary>('/admin/policy', {
    items: []
  });
}

export function getAdminNavigationTree() {
  return fetchJson<NavigationMenuTreeResponse>('/admin/navigation', {
    items: []
  });
}

export function updateAdminNavigationItem(
  menuItemId: string,
  input: UpdateNavigationMenuItemRequest
) {
  return patchJson<NavigationMenuTreeResponse, UpdateNavigationMenuItemRequest>(
    `/admin/navigation/${menuItemId}`,
    input,
    {
      items: []
    }
  );
}

function createFallbackAdminUserDetail(userId: string): AdminUserDetail {
  return {
    id: userId,
    email: '',
    name: '',
    status: 'ACTIVE',
    lockedReason: null,
    lockedAt: null,
    isSystemAdmin: false,
    emailVerified: false,
    createdAt: new Date().toISOString(),
    sessionCount: 0,
    activeSessionCount: 0,
    membershipCount: 0,
    activeMembershipCount: 0,
    memberships: [],
    sessions: [],
    recentSecurityThreats: []
  };
}
