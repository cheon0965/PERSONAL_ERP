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
