import type { RevokeAccountSessionResponse } from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class RevokeOtherSessionUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    currentSessionId: string,
    targetSessionId: string
  ): Promise<RevokeAccountSessionResponse> {
    return this.commands.revokeOtherSession(
      user,
      workspace,
      request,
      currentSessionId,
      targetSessionId
    );
  }
}
