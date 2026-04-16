import { Injectable } from '@nestjs/common';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { AuthRateLimitService } from '../../auth-rate-limit.service';
import { AuthSessionService } from '../../auth-session.service';
import type { AuthRequestContext, AuthSessionResult } from '../../auth.types';

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    private readonly authSessions: AuthSessionService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async execute(
    refreshToken: string,
    context: AuthRequestContext
  ): Promise<AuthSessionResult> {
    this.assertRefreshAttemptAllowed(context);

    try {
      const { session, user } = await this.authSessions.resolveRefreshSession(
        refreshToken,
        context
      );
      await this.authSessions.revokeSession(session.id);
      const nextSession = await this.authSessions.issueSession(user);
      this.rateLimit.clearRefreshAttempts(context.clientIp);
      this.securityEvents.log('auth.refresh_succeeded', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: user.id,
        sessionId: nextSession.sessionId
      });
      return nextSession;
    } catch (error) {
      this.rateLimit.recordFailedRefreshAttempt(context.clientIp);
      const reason = readSecurityReason(error);
      if (reason !== 'reused_refresh_token') {
        this.securityEvents.warn('auth.refresh_failed', {
          requestId: context.requestId,
          clientIp: context.clientIp,
          reason: reason ?? 'invalid_refresh_token'
        });
      }
      throw error;
    }
  }

  private assertRefreshAttemptAllowed(context: AuthRequestContext): void {
    try {
      this.rateLimit.assertRefreshAttemptAllowed(context.clientIp);
    } catch (error) {
      if (isTooManyRequestsError(error)) {
        this.securityEvents.warn('auth.refresh_rate_limited', {
          requestId: context.requestId,
          clientIp: context.clientIp
        });
      }
      throw error;
    }
  }
}

function isTooManyRequestsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getStatus' in error &&
    typeof (error as { getStatus: () => number }).getStatus === 'function' &&
    (error as { getStatus: () => number }).getStatus() === 429
  );
}

function readSecurityReason(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'securityReason' in error &&
    typeof (error as { securityReason?: unknown }).securityReason === 'string'
  ) {
    return (error as { securityReason: string }).securityReason;
  }

  return undefined;
}
