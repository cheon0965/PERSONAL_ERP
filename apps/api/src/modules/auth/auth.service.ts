import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthSessionService } from './auth-session.service';
import { LoginDto } from './dto/login.dto';
import type { AuthRequestContext, AuthSessionResult } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessions: AuthSessionService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async login(
    dto: LoginDto,
    context: AuthRequestContext
  ): Promise<AuthSessionResult> {
    this.assertLoginAttemptAllowed(context, dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });
    if (!user) {
      this.failInvalidLoginAttempt(context, dto.email);
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password
    );
    if (!passwordMatches) {
      this.failInvalidLoginAttempt(context, dto.email);
    }

    this.rateLimit.clearLoginAttempts(context.clientIp, dto.email);

    const result = await this.authSessions.issueSession({
      id: user.id,
      email: user.email,
      name: user.name
    });
    this.securityEvents.log('auth.login_succeeded', {
      requestId: context.requestId,
      clientIp: context.clientIp,
      userId: user.id,
      sessionId: result.sessionId
    });
    return result;
  }

  async refresh(
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

  async logout(
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
      // Logout is best-effort. The cookie is still cleared by the controller.
    }
  }

  private assertLoginAttemptAllowed(
    context: AuthRequestContext,
    email: string
  ): void {
    try {
      this.rateLimit.assertLoginAttemptAllowed(context.clientIp, email);
    } catch (error) {
      if (isTooManyRequestsError(error)) {
        this.securityEvents.warn('auth.login_rate_limited', {
          requestId: context.requestId,
          clientIp: context.clientIp
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

  private failInvalidLoginAttempt(
    context: AuthRequestContext,
    email: string
  ): never {
    this.rateLimit.recordFailedLoginAttempt(context.clientIp, email);
    this.securityEvents.warn('auth.login_failed', {
      requestId: context.requestId,
      clientIp: context.clientIp,
      reason: 'invalid_credentials'
    });
    throw new UnauthorizedException(
      '이메일 또는 비밀번호가 올바르지 않습니다.'
    );
  }
}

function isTooManyRequestsError(error: unknown): error is HttpException {
  return (
    error instanceof HttpException &&
    error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
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
