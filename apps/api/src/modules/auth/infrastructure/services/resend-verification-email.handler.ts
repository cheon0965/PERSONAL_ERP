import { Injectable } from '@nestjs/common';
import { AppError } from '../../../../common/application/errors/app-error';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthRateLimitService } from '../../application/services/auth-rate-limit.service';
import { normalizeEmail } from '../../domain/auth.normalization';
import type { AuthRequestContext } from '../../application/models/auth.types';
import { ResendVerificationDto } from '../../dto/resend-verification.dto';
import { RegisterHandler } from './register.handler';

const REGISTER_RESPONSE = { status: 'verification_sent' as const };

@Injectable()
export class ResendVerificationEmailHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger,
    private readonly registerUseCase: RegisterHandler
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
  return error instanceof AppError && error.kind === 'rate_limited';
}
