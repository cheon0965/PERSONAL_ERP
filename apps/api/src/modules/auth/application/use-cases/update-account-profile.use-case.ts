import type {
  AccountProfileItem,
  UpdateAccountProfileRequest
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class UpdateAccountProfileUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    input: UpdateAccountProfileRequest
  ): Promise<AccountProfileItem> {
    return this.commands.updateAccountProfile(user, workspace, request, input);
  }
}
