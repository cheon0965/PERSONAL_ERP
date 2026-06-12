import type {
  InviteTenantMemberRequest,
  TenantMemberInvitationItem
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { AdminMemberCommandPort } from '../ports/admin-member-command.port';

@ApplicationService()
export class InviteTenantMemberUseCase {
  constructor(private readonly commands: AdminMemberCommandPort) {}

  execute(
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    input: InviteTenantMemberRequest
  ): Promise<TenantMemberInvitationItem> {
    return this.commands.invite(workspace, request, input);
  }
}
