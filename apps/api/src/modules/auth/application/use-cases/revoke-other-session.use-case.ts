import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import {
  readClientIp,
  readRequestId,
  type RequestWithContext
} from '../../../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { WorkspaceAuditEventsService } from '../../../../common/infrastructure/operational/workspace-audit-events.service';
import { AuthSessionService } from '../../auth-session.service';

@Injectable()
export class RevokeOtherSessionUseCase {
  constructor(
    private readonly authSessions: AuthSessionService,
    private readonly auditEvents: WorkspaceAuditEventsService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async execute(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    currentSessionId: string,
    targetSessionId: string
  ): Promise<{ status: 'revoked' }> {
    if (targetSessionId === currentSessionId) {
      throw new BadRequestException(
        '현재 사용 중인 세션은 여기서 종료할 수 없습니다.'
      );
    }

    const revokedSession = await this.authSessions.revokeUserSession(
      user.id,
      targetSessionId
    );
    if (!revokedSession) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }

    if (!revokedSession.wasAlreadyRevoked) {
      await this.auditEvents.record({
        workspace,
        request,
        eventCategory: 'account_security',
        eventName: 'account.session_revoked',
        action: 'account_security.revoke_session',
        resourceType: 'auth_session',
        resourceId: targetSessionId,
        result: 'SUCCESS',
        metadata: {
          sessionId: targetSessionId
        }
      });
      this.securityEvents.log('auth.session_revoked', {
        requestId: readRequestId(request),
        clientIp: readClientIp(request),
        userId: user.id,
        sessionId: targetSessionId
      });
    }

    return { status: 'revoked' };
  }
}
