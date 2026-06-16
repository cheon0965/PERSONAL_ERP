import { Injectable } from '@nestjs/common';
import type {
  InviteTenantMemberRequest,
  UpdateTenantMemberRoleRequest,
  UpdateTenantMemberStatusRequest
} from '@personal-erp/contracts';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import type { RequestWithContext } from '../../../../common/infrastructure/operational/request-context';
import { AdminMemberCommandPort } from '../../application/ports/admin-member-command.port';
import { InviteTenantMemberHandler } from './invite-tenant-member.handler';
import { RemoveTenantMemberHandler } from './remove-tenant-member.handler';
import { UpdateTenantMemberRoleHandler } from './update-tenant-member-role.handler';
import { UpdateTenantMemberStatusHandler } from './update-tenant-member-status.handler';

@Injectable()
export class AdminMemberCommandAdapter extends AdminMemberCommandPort {
  constructor(
    private readonly inviteHandler: InviteTenantMemberHandler,
    private readonly updateRoleHandler: UpdateTenantMemberRoleHandler,
    private readonly updateStatusHandler: UpdateTenantMemberStatusHandler,
    private readonly removeHandler: RemoveTenantMemberHandler
  ) {
    super();
  }

  invite(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    input: InviteTenantMemberRequest
  ) {
    return this.inviteHandler.execute(
      workspace,
      request as RequestWithContext,
      input
    );
  }

  updateRole(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    membershipId: string,
    input: UpdateTenantMemberRoleRequest
  ) {
    return this.updateRoleHandler.execute(
      workspace,
      request as RequestWithContext,
      membershipId,
      input
    );
  }

  updateStatus(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    membershipId: string,
    input: UpdateTenantMemberStatusRequest
  ) {
    return this.updateStatusHandler.execute(
      workspace,
      request as RequestWithContext,
      membershipId,
      input
    );
  }

  remove(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    membershipId: string
  ) {
    return this.removeHandler.execute(
      workspace,
      request as RequestWithContext,
      membershipId
    );
  }
}
