import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthRateLimitService } from '../../auth-rate-limit.service';
import { AuthSessionService } from '../../auth-session.service';
import { normalizeEmail } from '../../auth.normalization';
import type { AuthRequestContext, AuthSessionResult } from '../../auth.types';
import { LoginDto } from '../../dto/login.dto';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessions: AuthSessionService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async execute(
    dto: LoginDto,
    context: AuthRequestContext
  ): Promise<AuthSessionResult> {
    const email = normalizeEmail(dto.email);
    this.assertLoginAttemptAllowed(context, email);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.failInvalidLoginAttempt(context, email);
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password
    );
    if (!passwordMatches) {
      this.failInvalidLoginAttempt(context, email);
    }

    if (!user.emailVerifiedAt) {
      this.failEmailNotVerifiedLoginAttempt(context, email);
    }

    this.rateLimit.clearLoginAttempts(context.clientIp, email);

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

  private failEmailNotVerifiedLoginAttempt(
    context: AuthRequestContext,
    email: string
  ): never {
    this.rateLimit.recordFailedLoginAttempt(context.clientIp, email);
    this.securityEvents.warn('auth.login_failed', {
      requestId: context.requestId,
      clientIp: context.clientIp,
      reason: 'email_not_verified'
    });
    throw new UnauthorizedException('이메일 인증을 완료한 뒤 로그인해 주세요.');
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
