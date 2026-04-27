import { Injectable } from '@nestjs/common';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { AuthSessionService } from '../../auth-session.service';
import type { AuthRequestContext } from '../../auth.types';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly authSessions: AuthSessionService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async execute(
    refreshToken: string | undefined,
    context: AuthRequestContext
  ): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const { session, user } = await this.authSessions.resolveRefreshSession(
        refreshToken,
        context
      );
      await this.authSessions.revokeSession(session.id);
      this.securityEvents.log('auth.logout_succeeded', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: user.id,
        sessionId: session.id
      });
    } catch {
      // 로그아웃은 best-effort로 처리한다. 쿠키는 컨트롤러에서 계속 정리한다.
    }
  }
}
