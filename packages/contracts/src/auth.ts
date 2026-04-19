export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

export type TenantMembershipRole = 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';

export type TenantMembershipStatus =
  | 'INVITED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REMOVED';

export type LedgerStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type AuthenticatedWorkspace = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
  };
  membership: {
    id: string;
    role: TenantMembershipRole;
    status: TenantMembershipStatus;
  };
  ledger: {
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
    status: LedgerStatus;
  } | null;
  supportContext?: {
    enabled: boolean;
    startedAt: string | null;
  };
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  isSystemAdmin?: boolean;
  currentWorkspace: AuthenticatedWorkspace | null;
};

export type AccountProfileItem = {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: string | null;
  preferredTimezone: string;
};

export type AccountSessionItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
};

export type AccountSecurityEventKind =
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'PASSWORD_CHANGED'
  | 'PROFILE_UPDATED';

export type AccountSecurityEventItem = {
  id: string;
  kind: AccountSecurityEventKind;
  occurredAt: string;
  requestId: string | null;
  sessionId: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
};

export type AccountSecurityOverview = {
  profile: AccountProfileItem;
  sessions: AccountSessionItem[];
  recentEvents: AccountSecurityEventItem[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthenticatedUser;
};

export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
};

export type UpdateAccountProfileRequest = {
  name: string;
  email: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  nextPassword: string;
};

export type RegisterResponse = {
  status: 'verification_sent';
};

export type ChangePasswordResponse = {
  status: 'changed';
};

export type RevokeAccountSessionResponse = {
  status: 'revoked';
};

export type VerifyEmailRequest = {
  token: string;
};

export type VerifyEmailResponse = {
  status: 'verified';
};

export type ResendVerificationRequest = {
  email: string;
};

export type AcceptInvitationRequest = {
  token: string;
};

export type AcceptInvitationResponse = {
  status: 'accepted' | 'registration_required';
};
