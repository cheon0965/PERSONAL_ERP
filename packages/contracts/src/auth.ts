export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

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
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  currentWorkspace: AuthenticatedWorkspace | null;
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

export type RegisterResponse = {
  status: 'verification_sent';
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
