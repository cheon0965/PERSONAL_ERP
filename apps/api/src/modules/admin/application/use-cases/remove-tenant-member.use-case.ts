import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { AdminMemberCommandPort } from '../ports/admin-member-command.port';

@ApplicationService()
export class RemoveTenantMemberUseCase {
  constructor(private readonly commands: AdminMemberCommandPort) {}

  execute(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    membershipId: string
  ): Promise<void> {
    return this.commands.remove(workspace, request, membershipId);
  }
}
