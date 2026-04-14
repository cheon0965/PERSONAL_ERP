import type { TenantMembershipRole, TenantMembershipStatus } from './auth';

export type AdminMemberItem = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: TenantMembershipRole;
  status: TenantMembershipStatus;
  joinedAt: string;
  lastAccessAt: string | null;
  invitedByMembershipId: string | null;
  emailVerified: boolean;
};

export type InviteTenantMemberRequest = {
  email: string;
  role: TenantMembershipRole;
};

export type TenantMemberInvitationItem = {
  id: string;
  email: string;
  role: TenantMembershipRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedByMembershipId: string;
  createdAt: string;
};

export type UpdateTenantMemberRoleRequest = {
  role: TenantMembershipRole;
};

export type UpdateTenantMemberStatusRequest = {
  status: Extract<TenantMembershipStatus, 'ACTIVE' | 'SUSPENDED' | 'REMOVED'>;
};

export type AdminAuditEventResult = 'SUCCESS' | 'DENIED' | 'FAILED';

export type AdminAuditEventItem = {
  id: string;
  tenantId: string;
  ledgerId: string | null;
  actorUserId: string | null;
  actorMembershipId: string | null;
  actorRole: string | null;
  eventCategory: string;
  eventName: string;
  action: string | null;
  resourceType: string | null;
  resourceId: string | null;
  result: AdminAuditEventResult;
  reason: string | null;
  requestId: string | null;
  path: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
  occurredAt: string;
};

export type AdminAuditEventQuery = {
  eventCategory?: string;
  action?: string;
  result?: AdminAuditEventResult;
  actorMembershipId?: string;
  requestId?: string;
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
};

export type AdminAuditEventListResponse = {
  items: AdminAuditEventItem[];
  total: number;
  offset: number;
  limit: number;
};
