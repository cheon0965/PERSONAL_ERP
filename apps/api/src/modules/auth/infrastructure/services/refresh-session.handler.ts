import { Injectable } from '@nestjs/common';
import { AppError } from '../../../../common/application/errors/app-error';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { AuthRateLimitService } from '../../application/services/auth-rate-limit.service';
import { AuthSessionService } from './auth-session.service';
import type {
  AuthRequestContext,
  AuthSessionResult
} from '../../application/models/auth.types';

@Injectable()
export class RefreshSessionHandler {
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
      const nextSession = await this.authSessions.issueSession(
        user,
        {
          tenantId: session.supportTenantId,
          ledgerId: session.supportLedgerId,
          startedAt: session.supportStartedAt
        },
        {
          tenantId: session.currentTenantId,
          ledgerId: session.currentLedgerId
        }
      );
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
  return error instanceof AppError && error.kind === 'rate_limited';
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
