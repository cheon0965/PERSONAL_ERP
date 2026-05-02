import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { EmailSenderPort } from '../../../../common/application/ports/email-sender.port';
import { parseJwtDurationToMs } from '../../../../common/auth/jwt-config';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { getApiEnv } from '../../../../config/api-env';
import { AuthRateLimitService } from '../../auth-rate-limit.service';
import { normalizeEmail } from '../../auth.normalization';
import type { AuthRequestContext } from '../../auth.types';
import { ForgotPasswordDto } from '../../dto/forgot-password.dto';

const FORGOT_PASSWORD_RESPONSE = { status: 'reset_email_sent' as const };

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: EmailSenderPort,
    private readonly clock: ClockPort,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async execute(
    dto: ForgotPasswordDto,
    context: AuthRequestContext
  ): Promise<typeof FORGOT_PASSWORD_RESPONSE> {
    const email = normalizeEmail(dto.email);

    this.assertForgotPasswordAllowed(context, email);
    this.rateLimit.recordForgotPasswordAttempt(context.clientIp, email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerifiedAt: true }
    });

    // 이메일 열거 방지: 사용자가 없거나 이메일 미인증이어도 동일 응답
    if (!user || !user.emailVerifiedAt) {
      this.securityEvents.warn('auth.forgot_password_no_user', {
        requestId: context.requestId,
        clientIp: context.clientIp
      });
      return FORGOT_PASSWORD_RESPONSE;
    }

    const rawToken = createPasswordResetToken();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + getPasswordResetTtlMs());

    // 기존 미사용 토큰 무효화
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now }
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashPasswordResetToken(rawToken),
        expiresAt
      }
    });

    try {
      await this.emailSender.send(
        buildPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl: buildPasswordResetUrl(rawToken)
        })
      );
      this.securityEvents.log('auth.password_reset_email_sent', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: user.id
      });
    } catch {
      this.securityEvents.error('auth.password_reset_email_send_failed', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: user.id
      });
      throw new ServiceUnavailableException(
        '비밀번호 재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    }

    return FORGOT_PASSWORD_RESPONSE;
  }

  private assertForgotPasswordAllowed(
    context: AuthRequestContext,
    email: string
  ): void {
    try {
      this.rateLimit.assertForgotPasswordAllowed(context.clientIp, email);
    } catch (error) {
      if (isTooManyRequestsError(error)) {
        this.securityEvents.warn('auth.forgot_password_rate_limited', {
          requestId: context.requestId,
          clientIp: context.clientIp
        });
      }
      throw error;
    }
  }
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

export function getPasswordResetTtlMs(): number {
  return parseJwtDurationToMs(
    getApiEnv().EMAIL_VERIFICATION_TTL,
    30 * 60 * 1000
  );
}

export function buildPasswordResetUrl(token: string): string {
  const url = new URL('/reset-password', getApiEnv().APP_ORIGIN);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const text = [
    `${input.name}님, PERSONAL_ERP 비밀번호 재설정을 요청하셨습니다.`,
    '',
    `비밀번호 재설정 링크: ${input.resetUrl}`,
    '',
    '본인이 요청하지 않았다면 이 메일을 무시해 주세요.',
    '링크는 30분 후에 만료됩니다.'
  ].join('\n');

  const escapedResetUrl = escapeHtml(input.resetUrl);
  const escapedName = escapeHtml(input.name);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>비밀번호 재설정</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f9; font-family:'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- 헤더 -->
          <tr>
            <td style="background:linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%); padding:36px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:800; letter-spacing:-0.02em;">
                PERSONAL ERP
              </h1>
              <p style="margin:8px 0 0; color:rgba(255,255,255,0.8); font-size:13px; font-weight:500;">
                비밀번호 재설정 안내
              </p>
            </td>
          </tr>
          <!-- 본문 -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <p style="margin:0 0 6px; color:#1a237e; font-size:17px; font-weight:700;">
                안녕하세요, ${escapedName}님
              </p>
              <p style="margin:0; color:#555; font-size:14px; line-height:1.7;">
                비밀번호 재설정을 요청하셨습니다.<br/>
                아래 버튼을 클릭하면 새 비밀번호를 설정할 수 있습니다.
              </p>
            </td>
          </tr>
          <!-- 주요 동작 버튼 -->
          <tr>
            <td style="padding:12px 40px 28px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:10px; background:linear-gradient(135deg, #1a237e, #3949ab);">
                    <a href="${escapedResetUrl}"
                       target="_blank"
                       style="display:inline-block; padding:14px 40px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; letter-spacing:0.02em;">
                      비밀번호 재설정하기
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- 구분선 -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none; border-top:1px solid #e8eaf0; margin:0;" />
            </td>
          </tr>
          <!-- 안내 -->
          <tr>
            <td style="padding:20px 40px 12px;">
              <p style="margin:0; color:#888; font-size:12px; line-height:1.7;">
                ⏱ 이 링크는 <strong>30분</strong> 후에 만료됩니다.<br/>
                🔒 본인이 요청하지 않았다면 이 메일을 무시해 주세요.<br/>
                계정 보안에 문제가 없다면 별도 조치는 필요하지 않습니다.
              </p>
            </td>
          </tr>
          <!-- 대체 URL -->
          <tr>
            <td style="padding:8px 40px 28px;">
              <p style="margin:0; color:#aaa; font-size:11px; line-height:1.6; word-break:break-all;">
                버튼이 작동하지 않으면 아래 링크를 브라우저에 직접 붙여넣기 하세요:<br/>
                <a href="${escapedResetUrl}" style="color:#3949ab; text-decoration:underline;">${escapedResetUrl}</a>
              </p>
            </td>
          </tr>
          <!-- 푸터 -->
          <tr>
            <td style="background-color:#f8f9fb; padding:20px 40px; text-align:center; border-top:1px solid #e8eaf0;">
              <p style="margin:0; color:#aaa; font-size:11px;">
                © PERSONAL ERP · 이 메일은 자동 발송되었습니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    to: input.to,
    subject: 'PERSONAL_ERP 비밀번호 재설정',
    text,
    html
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

function isTooManyRequestsError(error: unknown): error is Error {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getStatus' in error &&
    typeof (error as { getStatus: () => number }).getStatus === 'function' &&
    (error as { getStatus: () => number }).getStatus() === 429
  );
}
