import { BadRequestException, Injectable } from '@nestjs/common';
import type { VerifyEmailResponse } from '@personal-erp/contracts';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthRateLimitService } from '../../auth-rate-limit.service';
import { WorkspaceBootstrapService } from '../../workspace-bootstrap.service';
import type { AuthRequestContext } from '../../auth.types';
import { VerifyEmailDto } from '../../dto/verify-email.dto';
import { hashEmailVerificationToken } from './register.use-case';

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockPort,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger,
    private readonly workspaceBootstrap: WorkspaceBootstrapService
  ) {}

  async execute(
    dto: VerifyEmailDto,
    context: AuthRequestContext
  ): Promise<VerifyEmailResponse> {
    this.assertVerifyEmailAttemptAllowed(context);

    try {
      const verifiedUser = await this.prisma.$transaction(async (tx) => {
        const now = this.clock.now();
        const token = await tx.emailVerificationToken.findUnique({
          where: { tokenHash: hashEmailVerificationToken(dto.token) },
          include: { user: true }
        });

        if (!token) {
          throw createEmailVerificationError(
            'invalid_email_verification_token',
            '이메일 인증 링크가 올바르지 않습니다.'
          );
        }

        if (token.consumedAt) {
          throw createEmailVerificationError(
            'consumed_email_verification_token',
            '이미 사용한 이메일 인증 링크입니다.'
          );
        }

        if (token.expiresAt.getTime() <= now.getTime()) {
          throw createEmailVerificationError(
            'expired_email_verification_token',
            '이메일 인증 링크가 만료되었습니다. 다시 요청해 주세요.'
          );
        }

        await tx.emailVerificationToken.update({
          where: { id: token.id },
          data: { consumedAt: now }
        });

        if (!token.user.emailVerifiedAt) {
          await tx.user.update({
            where: { id: token.userId },
            data: { emailVerifiedAt: now }
          });
        }

        await this.workspaceBootstrap.ensureForUser(tx, token.userId);
        return { email: token.user.email, id: token.userId };
      });

      this.rateLimit.clearVerifyEmailAttempts(context.clientIp);
      this.rateLimit.clearLoginAttempts(context.clientIp, verifiedUser.email);
      this.securityEvents.log('auth.email_verified', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: verifiedUser.id
      });
      return { status: 'verified', email: verifiedUser.email };
    } catch (error) {
      if (isEmailVerificationError(error)) {
        this.rateLimit.recordFailedVerifyEmailAttempt(context.clientIp);
        this.securityEvents.warn('auth.email_verification_failed', {
          requestId: context.requestId,
          clientIp: context.clientIp,
          reason: (error as BadRequestException & { securityReason: string })
            .securityReason
        });
      }

      throw error;
    }
  }

  private assertVerifyEmailAttemptAllowed(context: AuthRequestContext): void {
    try {
      this.rateLimit.assertVerifyEmailAttemptAllowed(context.clientIp);
    } catch (error) {
      if (isTooManyRequestsError(error)) {
        this.securityEvents.warn('auth.email_verification_rate_limited', {
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

function createEmailVerificationError(
  reason: string,
  message: string
): BadRequestException & { securityReason: string } {
  const error = new BadRequestException(message) as BadRequestException & {
    securityReason: string;
  };
  error.securityReason = reason;
  return error;
}

function isEmailVerificationError(
  error: unknown
): error is BadRequestException & { securityReason: string } {
  return (
    error instanceof BadRequestException &&
    typeof (error as { securityReason?: unknown }).securityReason === 'string'
  );
}
