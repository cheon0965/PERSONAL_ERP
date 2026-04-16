import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { EmailSenderPort } from '../../../../common/application/ports/email-sender.port';
import { parseJwtDurationToMs } from '../../../../common/auth/jwt-config';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { getApiEnv } from '../../../../config/api-env';
import { AuthRateLimitService } from '../../auth-rate-limit.service';
import { normalizeDisplayName, normalizeEmail } from '../../auth.normalization';
import { WorkspaceBootstrapService } from '../../workspace-bootstrap.service';
import type { AuthRequestContext } from '../../auth.types';
import { RegisterDto } from '../../dto/register.dto';

const REGISTER_RESPONSE = { status: 'verification_sent' as const };

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: EmailSenderPort,
    private readonly clock: ClockPort,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger,
    private readonly workspaceBootstrap: WorkspaceBootstrapService
  ) {}

  async execute(
    dto: RegisterDto,
    context: AuthRequestContext
  ): Promise<typeof REGISTER_RESPONSE> {
    const email = normalizeEmail(dto.email);
    const name = normalizeDisplayName(dto.name);

    this.assertRegisterAttemptAllowed(context, email);
    this.rateLimit.recordRegisterAttempt(context.clientIp, email);

    const passwordHash = await argon2.hash(dto.password);
    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser?.emailVerifiedAt) {
      this.securityEvents.warn('auth.register_existing_email', {
        requestId: context.requestId,
        clientIp: context.clientIp
      });
      return REGISTER_RESPONSE;
    }

    if (existingUser) {
      const updatedUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { name, passwordHash }
      });
      await this.issueVerificationEmail(updatedUser, context, 'register');
      return REGISTER_RESPONSE;
    }

    try {
      const createdUser = await this.prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          settings: { create: {} }
        }
      });
      await this.issueVerificationEmail(createdUser, context, 'register');
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const racedUser = await this.prisma.user.findUnique({
          where: { email }
        });

        if (racedUser && !racedUser.emailVerifiedAt) {
          await this.issueVerificationEmail(racedUser, context, 'register');
        }

        return REGISTER_RESPONSE;
      }

      throw error;
    }

    return REGISTER_RESPONSE;
  }

  private assertRegisterAttemptAllowed(
    context: AuthRequestContext,
    email: string
  ): void {
    try {
      this.rateLimit.assertRegisterAttemptAllowed(context.clientIp, email);
    } catch (error) {
      if (isTooManyRequestsError(error)) {
        this.securityEvents.warn('auth.register_rate_limited', {
          requestId: context.requestId,
          clientIp: context.clientIp
        });
      }
      throw error;
    }
  }

  async issueVerificationEmail(
    user: { id: string; email: string; name: string },
    context: AuthRequestContext,
    reason: 'register' | 'resend'
  ): Promise<void> {
    const rawToken = createEmailVerificationToken();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + getEmailVerificationTtlMs());

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now }
    });
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashEmailVerificationToken(rawToken),
        expiresAt
      }
    });

    try {
      await this.emailSender.send(
        buildVerificationEmail({
          to: user.email,
          name: user.name,
          verificationUrl: buildVerificationUrl(rawToken)
        })
      );
      this.securityEvents.log('auth.verification_email_sent', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: user.id,
        reason
      });
    } catch {
      this.securityEvents.error('auth.verification_email_send_failed', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: user.id,
        reason
      });
      throw new ServiceUnavailableException(
        '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    }
  }
}

function isTooManyRequestsError(error: unknown): error is Error {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getStatus' in error &&
    typeof (error as { getStatus: () => number }).getStatus === 'function' &&
    (error as { getStatus: () => number }).getStatus() === 429
  );
}

export function createEmailVerificationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashEmailVerificationToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

export function getEmailVerificationTtlMs(): number {
  return parseJwtDurationToMs(
    getApiEnv().EMAIL_VERIFICATION_TTL,
    30 * 60 * 1000
  );
}

export function buildVerificationUrl(token: string): string {
  const url = new URL('/verify-email', getApiEnv().APP_ORIGIN);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildVerificationEmail(input: {
  to: string;
  name: string;
  verificationUrl: string;
}) {
  const text = [
    `${input.name}님, PERSONAL_ERP 회원가입 이메일 인증을 진행해 주세요.`,
    '',
    `인증 링크: ${input.verificationUrl}`,
    '',
    '본인이 요청하지 않았다면 이 메일을 무시해 주세요.'
  ].join('\n');

  const escapedVerificationUrl = escapeHtml(input.verificationUrl);
  const escapedName = escapeHtml(input.name);

  return {
    to: input.to,
    subject: 'PERSONAL_ERP 이메일 인증',
    text,
    html: [
      '<p>',
      escapedName,
      '님, PERSONAL_ERP 회원가입 이메일 인증을 진행해 주세요.',
      '</p>',
      '<p><a href="',
      escapedVerificationUrl,
      '">이메일 인증하기</a></p>',
      '<p>본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>'
    ].join('')
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
