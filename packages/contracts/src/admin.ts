import type {
  LedgerStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
  TenantStatus,
  UserStatus
} from './auth';

export type AdminMemberItem = {
  id: string;
  userId: string;
  email: string;
  name: string;
  tenant?: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
  };
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
  tenantId?: string;
};

export type AdminTenantItem = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  defaultLedgerId: string | null;
  defaultLedgerName: string | null;
  ledgerCount: number;
  memberCount: number;
  activeMemberCount: number;
  ownerCount: number;
};

export type AdminUserItem = {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  lockedReason: string | null;
  lockedAt: string | null;
  isSystemAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  sessionCount: number;
  activeSessionCount: number;
  membershipCount: number;
  activeMembershipCount: number;
};

export type AdminUserMembershipItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantMembershipRole;
  status: TenantMembershipStatus;
  joinedAt: string;
};

export type AdminUserSessionItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  supportTenantId: string | null;
  supportLedgerId: string | null;
  supportStartedAt: string | null;
};

export type UpdateAdminUserStatusRequest = {
  status: UserStatus;
  reason?: string;
};

export type UpdateAdminUserSystemAdminRequest = {
  isSystemAdmin: boolean;
};

export type UpdateAdminUserEmailVerificationRequest = {
  emailVerified: true;
};

export type RevokeAdminUserSessionsResponse = {
  revokedCount: number;
};

export type AdminTenantLedgerItem = {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
  status: LedgerStatus;
};

export type UpdateAdminTenantStatusRequest = {
  status: TenantStatus;
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
  eventName?: string;
  action?: string;
  result?: AdminAuditEventResult;
  actorMembershipId?: string;
  resourceType?: string;
  resourceId?: string;
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

export type AdminSecurityThreatSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type AdminSecurityThreatCategory =
  | 'AUTHENTICATION'
  | 'REGISTRATION'
  | 'SESSION'
  | 'EMAIL_VERIFICATION'
  | 'ACCESS_CONTROL'
  | 'BROWSER_ORIGIN'
  | 'EMAIL_DELIVERY'
  | 'SYSTEM';

export type AdminSecurityThreatEventItem = {
  id: string;
  severity: AdminSecurityThreatSeverity;
  eventCategory: AdminSecurityThreatCategory;
  eventName: string;
  source: string;
  requestId: string | null;
  path: string | null;
  clientIpHash: string | null;
  userId: string | null;
  sessionId: string | null;
  reason: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
  occurredAt: string;
};

export type AdminSecurityThreatEventQuery = {
  severity?: AdminSecurityThreatSeverity;
  eventCategory?: AdminSecurityThreatCategory;
  eventName?: string;
  requestId?: string;
  clientIpHash?: string;
  userId?: string;
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
};

export type AdminSecurityThreatEventListResponse = {
  items: AdminSecurityThreatEventItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminUserDetail = AdminUserItem & {
  memberships: AdminUserMembershipItem[];
  sessions: AdminUserSessionItem[];
  recentSecurityThreats: AdminSecurityThreatEventItem[];
};

export type AdminTenantDetail = AdminTenantItem & {
  ledgers: AdminTenantLedgerItem[];
  recentAuditEvents: AdminAuditEventItem[];
  recentSecurityThreats: AdminSecurityThreatEventItem[];
};

export type AdminSupportContext = {
  enabled: boolean;
  tenant: AdminTenantItem | null;
  ledger: AdminTenantLedgerItem | null;
  startedAt: string | null;
};

export type UpdateAdminSupportContextRequest = {
  tenantId: string;
  ledgerId?: string;
};

export type AdminOperationsStatusLevel = 'OK' | 'WARNING' | 'ERROR' | 'UNKNOWN';

export type AdminOperationsStatusComponent = {
  key: string;
  label: string;
  status: AdminOperationsStatusLevel;
  message: string;
};

export type AdminOperationsStatus = {
  checkedAt: string;
  components: AdminOperationsStatusComponent[];
  metrics: {
    totalUsers: number;
    lockedUsers: number;
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    highThreats24h: number;
    failedAuditEvents24h: number;
  };
  recentSecurityThreats: AdminSecurityThreatEventItem[];
  recentAuditEvents: AdminAuditEventItem[];
};

export type AdminPolicySurfaceSection =
  | 'SETTINGS'
  | 'ADMIN'
  | 'REFERENCE_DATA'
  | 'MONTHLY_OPERATIONS'
  | 'IMPORTS'
  | 'TRANSACTIONS'
  | 'OPERATING_ASSETS'
  | 'REPORTING'
  | 'DASHBOARD';

export type AdminPolicyCtaPolicy = 'ALLOW' | 'READ_ONLY' | 'HIDE';

export type AdminPolicySurfaceItem = {
  key: string;
  section: AdminPolicySurfaceSection;
  sectionLabel: string;
  surfaceLabel: string;
  href: string;
  description: string;
  allowedRoles: TenantMembershipRole[];
  ctaPolicy: AdminPolicyCtaPolicy;
};

export type AdminPolicySummary = {
  items: AdminPolicySurfaceItem[];
};
