import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from './authenticated-user.interface';

export type RequiredWorkspaceContext = {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  membershipId: string;
  membershipRole: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
  ledgerId: string;
  ledgerName: string;
  baseCurrency: string;
  timezone: string;
};

export function requireCurrentWorkspace(
  user: AuthenticatedUser
): RequiredWorkspaceContext {
  const workspace = user.currentWorkspace;

  if (!workspace || !workspace.ledger) {
    throw new ForbiddenException(
      '현재 작업 Tenant 및 Ledger 문맥을 찾을 수 없습니다.'
    );
  }

  return {
    userId: user.id,
    tenantId: workspace.tenant.id,
    tenantSlug: workspace.tenant.slug,
    tenantName: workspace.tenant.name,
    membershipId: workspace.membership.id,
    membershipRole: workspace.membership.role,
    ledgerId: workspace.ledger.id,
    ledgerName: workspace.ledger.name,
    baseCurrency: workspace.ledger.baseCurrency,
    timezone: workspace.ledger.timezone
  };
}
