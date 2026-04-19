import type {
  AdminAuditEventItem,
  AdminMemberItem,
  AdminSecurityThreatEventItem,
  TenantMemberInvitationItem
} from '@personal-erp/contracts';

type AdminMemberRecord = {
  id: string;
  userId: string;
  role: AdminMemberItem['role'];
  status: AdminMemberItem['status'];
  joinedAt: Date;
  lastAccessAt: Date | null;
  invitedByMembershipId: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    emailVerifiedAt: Date | null;
  };
  tenant?: {
    id: string;
    slug: string;
    name: string;
    status: NonNullable<AdminMemberItem['tenant']>['status'];
  };
};

export function mapAdminMemberToItem(
  record: AdminMemberRecord
): AdminMemberItem {
  return {
    id: record.id,
    userId: record.userId,
    email: record.user.email,
    name: record.user.name,
    ...(record.tenant
      ? {
          tenant: {
            id: record.tenant.id,
            slug: record.tenant.slug,
            name: record.tenant.name,
            status: record.tenant.status
          }
        }
      : {}),
    role: record.role,
    status: record.status,
    joinedAt: record.joinedAt.toISOString(),
    lastAccessAt: record.lastAccessAt?.toISOString() ?? null,
    invitedByMembershipId: record.invitedByMembershipId,
    emailVerified: Boolean(record.user.emailVerifiedAt)
  };
}

type TenantMemberInvitationRecord = {
  id: string;
  email: string;
  role: TenantMemberInvitationItem['role'];
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  invitedByMembershipId: string;
  createdAt: Date;
};

export function mapTenantMemberInvitationToItem(
  record: TenantMemberInvitationRecord
): TenantMemberInvitationItem {
  return {
    id: record.id,
    email: record.email,
    role: record.role,
    expiresAt: record.expiresAt.toISOString(),
    acceptedAt: record.acceptedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    invitedByMembershipId: record.invitedByMembershipId,
    createdAt: record.createdAt.toISOString()
  };
}

type AdminAuditEventRecord = {
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
  result: string;
  reason: string | null;
  requestId: string | null;
  path: string | null;
  metadata: unknown;
  occurredAt: Date;
};

export function mapAdminAuditEventToItem(
  record: AdminAuditEventRecord
): AdminAuditEventItem {
  return {
    id: record.id,
    tenantId: record.tenantId,
    ledgerId: record.ledgerId,
    actorUserId: record.actorUserId,
    actorMembershipId: record.actorMembershipId,
    actorRole: record.actorRole,
    eventCategory: record.eventCategory,
    eventName: record.eventName,
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    result: readAuditResult(record.result),
    reason: record.reason,
    requestId: record.requestId,
    path: record.path,
    metadata: readAuditMetadata(record.metadata),
    occurredAt: record.occurredAt.toISOString()
  };
}

type AdminSecurityThreatEventRecord = {
  id: string;
  severity: string;
  eventCategory: string;
  eventName: string;
  source: string;
  requestId: string | null;
  path: string | null;
  clientIpHash: string | null;
  userId: string | null;
  sessionId: string | null;
  reason: string | null;
  metadata: unknown;
  occurredAt: Date;
};

export function mapAdminSecurityThreatEventToItem(
  record: AdminSecurityThreatEventRecord
): AdminSecurityThreatEventItem {
  return {
    id: record.id,
    severity: readThreatSeverity(record.severity),
    eventCategory: readThreatCategory(record.eventCategory),
    eventName: record.eventName,
    source: record.source,
    requestId: record.requestId,
    path: record.path,
    clientIpHash: record.clientIpHash,
    userId: record.userId,
    sessionId: record.sessionId,
    reason: record.reason,
    metadata: readFlatMetadata(record.metadata),
    occurredAt: record.occurredAt.toISOString()
  };
}

function readAuditResult(value: string): AdminAuditEventItem['result'] {
  return value === 'DENIED' || value === 'FAILED' ? value : 'SUCCESS';
}

function readAuditMetadata(value: unknown): AdminAuditEventItem['metadata'] {
  return readFlatMetadata(value);
}

function readThreatSeverity(
  value: string
): AdminSecurityThreatEventItem['severity'] {
  switch (value) {
    case 'CRITICAL':
    case 'HIGH':
    case 'MEDIUM':
    case 'LOW':
      return value;
    default:
      return 'LOW';
  }
}

function readThreatCategory(
  value: string
): AdminSecurityThreatEventItem['eventCategory'] {
  switch (value) {
    case 'AUTHENTICATION':
    case 'REGISTRATION':
    case 'SESSION':
    case 'EMAIL_VERIFICATION':
    case 'ACCESS_CONTROL':
    case 'BROWSER_ORIGIN':
    case 'EMAIL_DELIVERY':
    case 'SYSTEM':
      return value;
    default:
      return 'SYSTEM';
  }
}

function readFlatMetadata(
  value: unknown
): Record<string, string | number | boolean | null> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean' ||
        entry === null
      ) {
        return [[key, entry]];
      }

      return [];
    })
  );
}
