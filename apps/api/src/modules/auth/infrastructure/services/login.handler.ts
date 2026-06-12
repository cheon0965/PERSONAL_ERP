import { Injectable } from '@nestjs/common';
import {
  AppError,
  unauthorizedError
} from '../../../../common/application/errors/app-error';
import * as argon2 from 'argon2';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthRateLimitService } from '../../application/services/auth-rate-limit.service';
import { AuthSessionService } from './auth-session.service';
import { normalizeEmail } from '../../domain/auth.normalization';
import type {
  AuthRequestContext,
  AuthSessionResult
} from '../../application/models/auth.types';
import { LoginDto } from '../../dto/login.dto';

@Injectable()
export class LoginHandler {
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

    if (user.status !== 'ACTIVE') {
      this.failInactiveUserLoginAttempt(context, email, user.status);
    }

    this.rateLimit.clearLoginAttempts(context.clientIp, email);

    const result = await this.authSessions.issueSession({
      id: user.id,
      email: user.email,
      name: user.name,
      ...(user.isSystemAdmin ? { isSystemAdmin: true } : {})
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
    throw unauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');
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
    throw unauthorizedError('이메일 인증을 완료한 뒤 로그인해 주세요.');
  }

  private failInactiveUserLoginAttempt(
    context: AuthRequestContext,
    email: string,
    status: string
  ): never {
    this.rateLimit.recordFailedLoginAttempt(context.clientIp, email);
    this.securityEvents.warn('auth.login_failed', {
      requestId: context.requestId,
      clientIp: context.clientIp,
      reason: 'user_not_active',
      status
    });
    throw unauthorizedError('사용할 수 없는 계정입니다.');
  }
}

function isTooManyRequestsError(error: unknown): boolean {
  return error instanceof AppError && error.kind === 'rate_limited';
}
