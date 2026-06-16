import type {
  AdminMemberItem,
  UpdateTenantMemberRoleRequest
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { AdminMemberCommandPort } from '../ports/admin-member-command.port';

@ApplicationService()
export class UpdateTenantMemberRoleUseCase {
  constructor(private readonly commands: AdminMemberCommandPort) {}

  execute(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    membershipId: string,
    input: UpdateTenantMemberRoleRequest
  ): Promise<AdminMemberItem> {
    return this.commands.updateRole(workspace, request, membershipId, input);
  }
}
