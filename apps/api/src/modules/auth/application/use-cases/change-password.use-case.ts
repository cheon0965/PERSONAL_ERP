import type {
  ChangePasswordRequest,
  ChangePasswordResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class ChangePasswordUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    user: { id: string; email: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    currentSessionId: string,
    input: ChangePasswordRequest
  ): Promise<ChangePasswordResponse> {
    return this.commands.changePassword(
      user,
      workspace,
      request,
      currentSessionId,
      input
    );
  }
}
