import { randomUUID } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse } from '@personal-erp/contracts';
import * as argon2 from 'argon2';
import {
  getAccessTokenSecret,
  getAccessTokenTtl,
  getRefreshTokenSecret,
  getRefreshTokenTtl,
  getRefreshTokenMaxAgeMs
} from '../../common/auth/jwt-config';
import { ClockPort } from '../../common/application/ports/clock.port';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedWorkspaceResolver } from '../../common/auth/authenticated-workspace-resolver';
import { LoginDto } from './dto/login.dto';
import { AuthRateLimitService } from './auth-rate-limit.service';

type AuthenticatedIdentity = {
  id: string;
  email: string;
  name: string;
};

type AccessTokenPayload = {
  sub: string;
  email: string;
  sid: string;
  type: 'access';
};

type RefreshTokenPayload = {
  sub: string;
  sid: string;
  type: 'refresh';
};

type AuthSessionResult = LoginResponse & {
  sessionId: string;
  refreshToken: string;
};

type AuthRequestContext = {
  clientIp: string;
  requestId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authenticatedWorkspaceResolver: AuthenticatedWorkspaceResolver,
    private readonly rateLimit: AuthRateLimitService,
    private readonly clock: ClockPort,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async login(
    dto: LoginDto,
    context: AuthRequestContext
  ): Promise<AuthSessionResult> {
    this.assertLoginAttemptAllowed(context, dto.email);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      this.rateLimit.recordFailedLoginAttempt(context.clientIp, dto.email);
      this.securityEvents.warn('auth.login_failed', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        reason: 'invalid_credentials'
      });
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) {
      this.rateLimit.recordFailedLoginAttempt(context.clientIp, dto.email);
      this.securityEvents.warn('auth.login_failed', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        reason: 'invalid_credentials'
      });
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    this.rateLimit.clearLoginAttempts(context.clientIp, dto.email);

    const result = await this.issueSession({
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
      const { session, user } = await this.resolveRefreshSession(
        refreshToken,
        context
      );
      await this.revokeSession(session.id);
      const nextSession = await this.issueSession(user);
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
      const { session, user } = await this.resolveRefreshSession(
        refreshToken,
        context
      );
      await this.revokeSession(session.id);
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

  private async issueSession(
    user: AuthenticatedIdentity
  ): Promise<AuthSessionResult> {
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(
      this.clock.now().getTime() + getRefreshTokenMaxAgeMs()
    );

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        sid: sessionId,
        type: 'access'
      } satisfies AccessTokenPayload,
      { secret: getAccessTokenSecret(), expiresIn: getAccessTokenTtl() }
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
        type: 'refresh'
      } satisfies RefreshTokenPayload,
      { secret: getRefreshTokenSecret(), expiresIn: getRefreshTokenTtl() }
    );

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: await argon2.hash(refreshToken),
        expiresAt: refreshExpiresAt
      }
    });

    return {
      sessionId,
      accessToken,
      refreshToken,
      user: await this.authenticatedWorkspaceResolver.buildAuthenticatedUser(user)
    };
  }

  private async resolveRefreshSession(
    refreshToken: string,
    context: AuthRequestContext
  ): Promise<{
    session: {
      id: string;
      userId: string;
      refreshTokenHash: string;
      expiresAt: Date;
      revokedAt: Date | null;
    };
    user: AuthenticatedIdentity;
  }> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: getRefreshTokenSecret()
        }
      );
    } catch {
      throw createSecurityTaggedUnauthorizedError(
        'invalid_refresh_token',
        'Invalid refresh token'
      );
    }

    if (!payload.sub || !payload.sid || payload.type !== 'refresh') {
      throw createSecurityTaggedUnauthorizedError(
        'invalid_refresh_token',
        'Invalid refresh token'
      );
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid }
    });

    if (!session || session.userId !== payload.sub) {
      throw createSecurityTaggedUnauthorizedError(
        'invalid_refresh_token',
        'Invalid refresh token'
      );
    }

    const tokenMatches = await argon2.verify(
      session.refreshTokenHash,
      refreshToken
    );
    if (!tokenMatches) {
      throw createSecurityTaggedUnauthorizedError(
        'invalid_refresh_token',
        'Invalid refresh token'
      );
    }

    if (session.revokedAt) {
      await this.revokeAllUserSessions(session.userId);
      this.securityEvents.warn('auth.refresh_reuse_detected', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: session.userId,
        sessionId: session.id
      });
      throw createSecurityTaggedUnauthorizedError(
        'reused_refresh_token',
        'Invalid refresh token'
      );
    }

    if (session.expiresAt.getTime() <= this.clock.now().getTime()) {
      await this.revokeSession(session.id);
      throw createSecurityTaggedUnauthorizedError(
        'refresh_token_expired',
        'Invalid refresh token'
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      await this.revokeSession(session.id);
      throw createSecurityTaggedUnauthorizedError(
        'refresh_user_not_found',
        'Invalid refresh token'
      );
    }

    return { session, user };
  }

  private async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null
      },
      data: {
        revokedAt: this.clock.now()
      }
    });
  }

  private async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: this.clock.now()
      }
    });
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
}

function isTooManyRequestsError(error: unknown): error is HttpException {
  return error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS;
}

function createSecurityTaggedUnauthorizedError(
  reason: string,
  message: string
): UnauthorizedException & { securityReason: string } {
  const error = new UnauthorizedException(message) as UnauthorizedException & {
    securityReason: string;
  };
  error.securityReason = reason;
  return error;
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
