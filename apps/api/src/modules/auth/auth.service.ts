import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type {
  AcceptInvitationResponse,
  AccountProfileItem,
  AccountSecurityEventItem,
  AccountSecurityOverview,
  ChangePasswordResponse
} from '@personal-erp/contracts';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { ClockPort } from '../../common/application/ports/clock.port';
import { EmailSenderPort } from '../../common/application/ports/email-sender.port';
import { parseJwtDurationToMs } from '../../common/auth/jwt-config';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import {
  readClientIp,
  readRequestId,
  type RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { WorkspaceAuditEventsService } from '../../common/infrastructure/operational/workspace-audit-events.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getApiEnv } from '../../config/api-env';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthSessionService } from './auth-session.service';
import { LoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { WorkspaceBootstrapService } from './workspace-bootstrap.service';
import type { AuthRequestContext, AuthSessionResult } from './auth.types';

const REGISTER_RESPONSE = { status: 'verification_sent' as const };
const VERIFY_EMAIL_RESPONSE = { status: 'verified' as const };
const INVITATION_REGISTRATION_REQUIRED_RESPONSE = {
  status: 'registration_required' as const
};
const INVITATION_ACCEPTED_RESPONSE = { status: 'accepted' as const };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessions: AuthSessionService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly securityEvents: SecurityEventLogger,
    private readonly emailSender: EmailSenderPort,
    private readonly clock: ClockPort,
    private readonly workspaceBootstrap: WorkspaceBootstrapService,
    private readonly auditEvents: WorkspaceAuditEventsService
  ) {}

  async register(dto: RegisterDto, context: AuthRequestContext) {
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
        data: {
          name,
          passwordHash
        }
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
          settings: {
            create: {}
          }
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

  async verifyEmail(
    dto: VerifyEmailDto,
    context: AuthRequestContext
  ): Promise<typeof VERIFY_EMAIL_RESPONSE> {
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
      return VERIFY_EMAIL_RESPONSE;
    } catch (error) {
      if (isEmailVerificationError(error)) {
        this.rateLimit.recordFailedVerifyEmailAttempt(context.clientIp);
        this.securityEvents.warn('auth.email_verification_failed', {
          requestId: context.requestId,
          clientIp: context.clientIp,
          reason: error.securityReason
        });
      }

      throw error;
    }
  }

  async resendVerificationEmail(
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

    await this.issueVerificationEmail(user, context, 'resend');
    return REGISTER_RESPONSE;
  }

  async acceptInvitation(
    dto: AcceptInvitationDto,
    context: AuthRequestContext
  ): Promise<AcceptInvitationResponse> {
    const tokenHash = hashInvitationToken(dto.token);

    try {
      const response = await this.prisma.$transaction(async (tx) => {
        const now = this.clock.now();
        const invitation = await tx.tenantMembershipInvitation.findUnique({
          where: { tokenHash }
        });

        if (!invitation) {
          throw createInvitationError(
            'invalid_membership_invitation_token',
            '초대 링크가 올바르지 않습니다.'
          );
        }

        if (invitation.acceptedAt) {
          throw createInvitationError(
            'consumed_membership_invitation_token',
            '이미 사용한 초대 링크입니다.'
          );
        }

        if (invitation.revokedAt) {
          throw createInvitationError(
            'revoked_membership_invitation_token',
            '취소된 초대 링크입니다.'
          );
        }

        if (invitation.expiresAt.getTime() <= now.getTime()) {
          throw createInvitationError(
            'expired_membership_invitation_token',
            '초대 링크가 만료되었습니다.'
          );
        }

        const user = await tx.user.findUnique({
          where: { email: invitation.normalizedEmail },
          select: { id: true, emailVerifiedAt: true }
        });

        if (!user) {
          return INVITATION_REGISTRATION_REQUIRED_RESPONSE;
        }

        const existingMembership = await tx.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: invitation.tenantId,
              userId: user.id
            }
          }
        });

        if (existingMembership) {
          await tx.tenantMembership.update({
            where: { id: existingMembership.id },
            data: {
              role: invitation.role,
              status: 'ACTIVE',
              invitedByMembershipId: invitation.invitedByMembershipId
            }
          });
        } else {
          await tx.tenantMembership.create({
            data: {
              tenantId: invitation.tenantId,
              userId: user.id,
              role: invitation.role,
              status: 'ACTIVE',
              invitedByMembershipId: invitation.invitedByMembershipId
            }
          });
        }

        if (!user.emailVerifiedAt) {
          await tx.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: now }
          });
        }

        await tx.tenantMembershipInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: now }
        });

        return INVITATION_ACCEPTED_RESPONSE;
      });

      this.securityEvents.log('auth.invitation_accepted', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        status: response.status
      });
      return response;
    } catch (error) {
      if (isInvitationError(error)) {
        this.securityEvents.warn('auth.invitation_accept_failed', {
          requestId: context.requestId,
          clientIp: context.clientIp,
          reason: error.securityReason
        });
      }

      throw error;
    }
  }

  async login(
    dto: LoginDto,
    context: AuthRequestContext
  ): Promise<AuthSessionResult> {
    const email = normalizeEmail(dto.email);
    this.assertLoginAttemptAllowed(context, email);

    const user = await this.prisma.user.findUnique({
      where: { email }
    });
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

  async getAccountSecurity(
    user: { id: string; email: string; name: string },
    workspace: RequiredWorkspaceContext,
    currentSessionId: string
  ): Promise<AccountSecurityOverview> {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        settings: {
          select: {
            timezone: true
          }
        }
      }
    });

    if (!userRecord) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const sessions = await this.authSessions.listUserSessions(
      user.id,
      currentSessionId
    );
    const recentEvents = await this.buildAccountSecurityEvents(
      user.id,
      workspace,
      sessions
    );

    return {
      profile: mapAccountProfileItem(userRecord, workspace.timezone),
      sessions,
      recentEvents
    };
  }

  async updateAccountProfile(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    input: { name: string }
  ): Promise<AccountProfileItem> {
    const nextName = normalizeDisplayName(input.name);
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        settings: {
          select: {
            timezone: true
          }
        }
      }
    });

    if (!currentUser) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (currentUser.name !== nextName) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: nextName
        }
      });

      await this.auditEvents.record({
        workspace,
        request,
        eventCategory: 'account_profile',
        eventName: 'account.profile_updated',
        action: 'account_profile.update',
        resourceType: 'user',
        resourceId: user.id,
        result: 'SUCCESS',
        metadata: {
          previousName: currentUser.name,
          nextName
        }
      });
      this.securityEvents.log('auth.account_profile_updated', {
        requestId: readRequestId(request),
        clientIp: readClientIp(request),
        userId: user.id
      });
    }

    return {
      id: currentUser.id,
      email: currentUser.email,
      name: nextName,
      emailVerifiedAt: currentUser.emailVerifiedAt?.toISOString() ?? null,
      preferredTimezone: currentUser.settings?.timezone ?? workspace.timezone
    };
  }

  async changePassword(
    user: { id: string; email: string },
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    currentSessionId: string,
    input: { currentPassword: string; nextPassword: string }
  ): Promise<ChangePasswordResponse> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true
      }
    });

    if (!currentUser) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const currentPasswordMatches = await argon2.verify(
      currentUser.passwordHash,
      input.currentPassword
    );
    if (!currentPasswordMatches) {
      this.securityEvents.warn('auth.password_change_failed', {
        requestId: readRequestId(request),
        clientIp: readClientIp(request),
        userId: user.id,
        reason: 'invalid_current_password'
      });
      throw new UnauthorizedException(
        '현재 비밀번호가 올바르지 않습니다.'
      );
    }

    const nextPasswordMatchesCurrent = await argon2.verify(
      currentUser.passwordHash,
      input.nextPassword
    );
    if (nextPasswordMatchesCurrent) {
      throw new BadRequestException(
        '새 비밀번호는 현재 비밀번호와 달라야 합니다.'
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(input.nextPassword)
      }
    });
    const revokedSessionCount = await this.authSessions.revokeOtherUserSessions(
      user.id,
      currentSessionId
    );

    await this.auditEvents.record({
      workspace,
      request,
      eventCategory: 'account_security',
      eventName: 'account.password_changed',
      action: 'account_security.change_password',
      resourceType: 'user',
      resourceId: user.id,
      result: 'SUCCESS',
      metadata: {
        revokedSessionCount
      }
    });
    this.securityEvents.log('auth.password_changed', {
      requestId: readRequestId(request),
      clientIp: readClientIp(request),
      userId: user.id,
      sessionId: currentSessionId,
      revokedSessionCount
    });

    return { status: 'changed' };
  }

  async revokeOtherSession(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    currentSessionId: string,
    targetSessionId: string
  ): Promise<{ status: 'revoked' }> {
    if (targetSessionId === currentSessionId) {
      throw new BadRequestException(
        '현재 사용 중인 세션은 여기서 종료할 수 없습니다.'
      );
    }

    const revokedSession = await this.authSessions.revokeUserSession(
      user.id,
      targetSessionId
    );
    if (!revokedSession) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }

    if (!revokedSession.wasAlreadyRevoked) {
      await this.auditEvents.record({
        workspace,
        request,
        eventCategory: 'account_security',
        eventName: 'account.session_revoked',
        action: 'account_security.revoke_session',
        resourceType: 'auth_session',
        resourceId: targetSessionId,
        result: 'SUCCESS',
        metadata: {
          sessionId: targetSessionId
        }
      });
      this.securityEvents.log('auth.session_revoked', {
        requestId: readRequestId(request),
        clientIp: readClientIp(request),
        userId: user.id,
        sessionId: targetSessionId
      });
    }

    return { status: 'revoked' };
  }

  private async buildAccountSecurityEvents(
    userId: string,
    workspace: RequiredWorkspaceContext,
    sessions: Array<{
      id: string;
      createdAt: string;
      revokedAt: string | null;
      isCurrent: boolean;
    }>
  ): Promise<AccountSecurityEventItem[]> {
    const accountAuditEvents = (
      await this.prisma.workspaceAuditEvent.findMany({
        where: {
          tenantId: workspace.tenantId
        },
        take: 50
      })
    )
      .filter(
        (candidate) =>
          candidate.actorUserId === userId &&
          (candidate.action === 'account_profile.update' ||
            candidate.action === 'account_security.change_password')
      )
      .map<AccountSecurityEventItem>((candidate) => ({
        id: candidate.id,
        kind:
          candidate.action === 'account_security.change_password'
            ? 'PASSWORD_CHANGED'
            : 'PROFILE_UPDATED',
        occurredAt: candidate.occurredAt.toISOString(),
        requestId: candidate.requestId ?? null,
        sessionId: null,
        metadata: normalizeAccountEventMetadata(candidate.metadata)
      }));

    const sessionEvents = sessions.flatMap<AccountSecurityEventItem>((session) => {
      const createdEvent: AccountSecurityEventItem = {
        id: `session-created:${session.id}`,
        kind: 'SESSION_CREATED',
        occurredAt: session.createdAt,
        requestId: null,
        sessionId: session.id,
        metadata: {
          isCurrent: session.isCurrent
        }
      };

      if (!session.revokedAt) {
        return [createdEvent];
      }

      return [
        createdEvent,
        {
          id: `session-revoked:${session.id}`,
          kind: 'SESSION_REVOKED',
          occurredAt: session.revokedAt,
          requestId: null,
          sessionId: session.id,
          metadata: {
            isCurrent: session.isCurrent
          }
        }
      ];
    });

    return [...accountAuditEvents, ...sessionEvents]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
      )
      .slice(0, 10);
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

  private async issueVerificationEmail(
    user: {
      id: string;
      email: string;
      name: string;
    },
    context: AuthRequestContext,
    reason: 'register' | 'resend'
  ): Promise<void> {
    const rawToken = createEmailVerificationToken();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + getEmailVerificationTtlMs());

    await this.prisma.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        consumedAt: null
      },
      data: {
        consumedAt: now
      }
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new BadRequestException('이름을 입력해 주세요.');
  }

  return normalized;
}

function createEmailVerificationToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashEmailVerificationToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

function getEmailVerificationTtlMs(): number {
  return parseJwtDurationToMs(
    getApiEnv().EMAIL_VERIFICATION_TTL,
    30 * 60 * 1000
  );
}

function buildVerificationUrl(token: string): string {
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

function mapAccountProfileItem(
  user: {
    id: string;
    email: string;
    name: string;
    emailVerifiedAt: Date | null;
    settings: { timezone?: string } | null;
  },
  fallbackTimezone: string
): AccountProfileItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    preferredTimezone: user.settings?.timezone ?? fallbackTimezone
  };
}

function normalizeAccountEventMetadata(
  value: unknown
): Record<string, string | number | boolean | null> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, candidate]) => {
      if (
        typeof candidate === 'string' ||
        typeof candidate === 'number' ||
        typeof candidate === 'boolean' ||
        candidate === null
      ) {
        return [[key, candidate]];
      }

      return [];
    })
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

function createInvitationError(
  reason: string,
  message: string
): BadRequestException & { securityReason: string } {
  const error = new BadRequestException(message) as BadRequestException & {
    securityReason: string;
  };
  error.securityReason = reason;
  return error;
}

function isInvitationError(
  error: unknown
): error is BadRequestException & { securityReason: string } {
  return (
    error instanceof BadRequestException &&
    typeof (error as { securityReason?: unknown }).securityReason === 'string'
  );
}
