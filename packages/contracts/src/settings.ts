import type { LedgerStatus, TenantMembershipRole, TenantStatus } from './auth';

export type WorkspaceSettingsItem = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
  };
  ledger: {
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
    status: LedgerStatus;
    openedFromYearMonth: string;
    closedThroughYearMonth: string | null;
  };
  membershipRole: TenantMembershipRole;
  canManage: boolean;
};

export type UpdateWorkspaceSettingsRequest = {
  tenantName: string;
  tenantSlug: string;
  tenantStatus: TenantStatus;
  ledgerName: string;
  baseCurrency: string;
  timezone: string;
};
