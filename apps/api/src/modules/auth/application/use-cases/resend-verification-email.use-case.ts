import { Injectable } from '@nestjs/common';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthRateLimitService } from '../../auth-rate-limit.service';
import { normalizeEmail } from '../../auth.normalization';
import type { AuthRequestContext } from '../../auth.types';
import { ResendVerificationDto } from '../../dto/resend-verification.dto';
import { RegisterUseCase } from './register.use-case';

const REGISTER_RESPONSE = { status: 'verification_sent' as const };

@Injectable()
export class ResendVerificationEmailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger,
    private readonly registerUseCase: RegisterUseCase
  ) {}

  async execute(
    dto: ResendVerificationDto,
    context: AuthRequestContext
  ): Promise<typeof REGISTER_RESPONSE> {
    const email = normalizeEmail(dto.email);

    this.assertResendVerificationAttemptAllowed(context, email);
    this.rateLimit.recordResendVerificationAttempt(context.clientIp, email);

    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user || user.emailVerifiedAt) {
      return REGISTER_RESPONSE;
    }

    await this.registerUseCase.issueVerificationEmail(user, context, 'resend');
    return REGISTER_RESPONSE;
  }

  private assertResendVerificationAttemptAllowed(
    context: AuthRequestContext,
    email: string
  ): void {
    try {
      this.rateLimit.assertResendVerificationAttemptAllowed(
        context.clientIp,
        email
      );
    } catch (error) {
      if (isTooManyRequestsError(error)) {
        this.securityEvents.warn('auth.verification_resend_rate_limited', {
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
