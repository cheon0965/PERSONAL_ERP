import type {
  AdminMemberItem,
  InviteTenantMemberRequest,
  TenantMemberInvitationItem,
  UpdateTenantMemberRoleRequest,
  UpdateTenantMemberStatusRequest
} from '@personal-erp/contracts';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';

export abstract class AdminMemberCommandPort {
  abstract invite(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    input: InviteTenantMemberRequest
  ): Promise<TenantMemberInvitationItem>;

  abstract updateRole(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    membershipId: string,
    input: UpdateTenantMemberRoleRequest
  ): Promise<AdminMemberItem>;

  abstract updateStatus(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    membershipId: string,
    input: UpdateTenantMemberStatusRequest
  ): Promise<AdminMemberItem>;

  abstract remove(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    membershipId: string
  ): Promise<void>;
}
