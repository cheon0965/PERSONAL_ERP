import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthRateLimitService } from '../../auth-rate-limit.service';
import { AuthSessionService } from '../../auth-session.service';
import type { AuthRequestContext } from '../../auth.types';
import { ResetPasswordDto } from '../../dto/reset-password.dto';
import { PasswordPolicyService } from '../../password-policy.service';
import { hashPasswordResetToken } from './forgot-password.use-case';

const RESET_PASSWORD_RESPONSE = { status: 'password_reset' as const };

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockPort,
    private readonly rateLimit: AuthRateLimitService,
    private readonly authSessions: AuthSessionService,
    private readonly securityEvents: SecurityEventLogger,
    private readonly passwordPolicy: PasswordPolicyService
  ) {}

  async execute(
    dto: ResetPasswordDto,
    context: AuthRequestContext
  ): Promise<typeof RESET_PASSWORD_RESPONSE> {
    this.assertResetPasswordAllowed(context);

    try {
      await this.prisma.$transaction(async (tx) => {
        const now = this.clock.now();
        const token = await tx.passwordResetToken.findUnique({
          where: { tokenHash: hashPasswordResetToken(dto.token) },
          include: { user: true }
        });

        if (!token) {
          throw createResetPasswordError(
            'invalid_reset_token',
            '비밀번호 재설정 링크가 올바르지 않습니다.'
          );
        }

        if (token.consumedAt) {
          throw createResetPasswordError(
            'consumed_reset_token',
            '이미 사용한 비밀번호 재설정 링크입니다.'
          );
        }

        if (token.expiresAt.getTime() <= now.getTime()) {
          throw createResetPasswordError(
            'expired_reset_token',
            '비밀번호 재설정 링크가 만료되었습니다. 다시 요청해 주세요.'
          );
        }

        this.passwordPolicy.assertAcceptable(dto.newPassword, {
          email: token.user.email,
          name: token.user.name
        });

        // 토큰 사용 처리
        await tx.passwordResetToken.update({
          where: { id: token.id },
          data: { consumedAt: now }
        });

        // 비밀번호 변경
        const newPasswordHash = await argon2.hash(dto.newPassword);
        await tx.user.update({
          where: { id: token.userId },
          data: { passwordHash: newPasswordHash }
        });

        // 모든 세션 만료 처리
        await this.authSessions.revokeAllUserSessions(token.userId);

        this.securityEvents.log('auth.password_reset_completed', {
          requestId: context.requestId,
          clientIp: context.clientIp,
          userId: token.userId
        });
      });

      this.rateLimit.clearResetPasswordAttempts(context.clientIp);
      return RESET_PASSWORD_RESPONSE;
    } catch (error) {
      if (isResetPasswordError(error)) {
        this.rateLimit.recordFailedResetPasswordAttempt(context.clientIp);
        this.securityEvents.warn('auth.password_reset_failed', {
          requestId: context.requestId,
          clientIp: context.clientIp,
          reason: (error as BadRequestException & { securityReason: string })
            .securityReason
        });
      }

      throw error;
    }
  }

  private assertResetPasswordAllowed(context: AuthRequestContext): void {
    try {
      this.rateLimit.assertResetPasswordAllowed(context.clientIp);
    } catch (error) {
      if (isTooManyRequestsError(error)) {
        this.securityEvents.warn('auth.password_reset_rate_limited', {
          requestId: context.requestId,
          clientIp: context.clientIp
        });
      }
      throw error;
    }
  }
}

function createResetPasswordError(
  reason: string,
  message: string
): BadRequestException & { securityReason: string } {
  const error = new BadRequestException(message) as BadRequestException & {
    securityReason: string;
  };
  error.securityReason = reason;
  return error;
}

function isResetPasswordError(
  error: unknown
): error is BadRequestException & { securityReason: string } {
  return (
    error instanceof BadRequestException &&
    typeof (error as { securityReason?: unknown }).securityReason === 'string'
  );
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
