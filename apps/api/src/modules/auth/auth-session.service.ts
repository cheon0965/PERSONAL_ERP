import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { AccountSessionItem } from '@personal-erp/contracts';
import {
  getAccessTokenSecret,
  getAccessTokenTtl,
  getRefreshTokenSecret,
  getRefreshTokenTtl,
  getRefreshTokenMaxAgeMs
} from '../../common/auth/jwt-config';
import { AuthenticatedWorkspaceResolver } from '../../common/auth/authenticated-workspace-resolver';
import { ClockPort } from '../../common/application/ports/clock.port';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  AuthenticatedIdentity,
  AuthRequestContext,
  AuthSessionResult,
  AuthSessionSupportContext
} from './auth.types';

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

type AuthSessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  supportTenantId: string | null;
  supportLedgerId: string | null;
  supportStartedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authenticatedWorkspaceResolver: AuthenticatedWorkspaceResolver,
    private readonly clock: ClockPort,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async issueSession(
    user: AuthenticatedIdentity,
    supportContext?: AuthSessionSupportContext
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
        expiresAt: refreshExpiresAt,
        supportTenantId: supportContext?.tenantId ?? null,
        supportLedgerId: supportContext?.ledgerId ?? null,
        supportStartedAt: supportContext?.startedAt ?? null
      }
    });

    return {
      sessionId,
      accessToken,
      refreshToken,
      user: await this.authenticatedWorkspaceResolver.buildAuthenticatedUser(
        user,
        supportContext
      )
    };
  }

  async resolveRefreshSession(
    refreshToken: string,
    context: AuthRequestContext
  ): Promise<{
    session: AuthSessionRecord;
    user: AuthenticatedIdentity;
  }> {
    const payload = await this.verifyRefreshTokenPayload(refreshToken);
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
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        isSystemAdmin: true
      }
    });

    if (!user || user.status !== 'ACTIVE') {
      await this.revokeSession(session.id);
      throw createSecurityTaggedUnauthorizedError(
        user ? 'refresh_user_not_active' : 'refresh_user_not_found',
        'Invalid refresh token'
      );
    }

    return {
      session,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ...(user.isSystemAdmin ? { isSystemAdmin: true } : {})
      }
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
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

  async listUserSessions(
    userId: string,
    currentSessionId: string
  ): Promise<AccountSessionItem[]> {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId }
    });

    return [...sessions]
      .sort((left, right) => {
        const leftRank = left.revokedAt ? 1 : 0;
        const rightRank = right.revokedAt ? 1 : 0;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return right.updatedAt.getTime() - left.updatedAt.getTime();
      })
      .map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        isCurrent: session.id === currentSessionId
      }));
  }

  async revokeOtherUserSessions(
    userId: string,
    currentSessionId: string
  ): Promise<number> {
    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: {
          not: currentSessionId
        }
      },
      data: {
        revokedAt: this.clock.now()
      }
    });

    return result.count;
  }

  async revokeUserSession(
    userId: string,
    sessionId: string
  ): Promise<{
    session: AuthSessionRecord;
    wasAlreadyRevoked: boolean;
  } | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.userId !== userId) {
      return null;
    }

    if (session.revokedAt) {
      return {
        session,
        wasAlreadyRevoked: true
      };
    }

    const revokedAt = this.clock.now();
    await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        userId,
        revokedAt: null
      },
      data: {
        revokedAt
      }
    });

    return {
      session: {
        ...session,
        revokedAt,
        updatedAt: revokedAt
      },
      wasAlreadyRevoked: false
    };
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

  private async verifyRefreshTokenPayload(
    refreshToken: string
  ): Promise<RefreshTokenPayload> {
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

    return payload;
  }
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
