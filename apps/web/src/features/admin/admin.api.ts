import type {
  AdminAuditEventItem,
  AdminAuditEventListResponse,
  AdminAuditEventQuery,
  AdminMemberItem,
  InviteTenantMemberRequest,
  TenantMemberInvitationItem,
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
export const adminAuditEventsQueryKey = ['admin', 'audit-events'] as const;

export function getAdminMembers() {
  return fetchJson<AdminMemberItem[]>('/admin/members', []);
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
