import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import {
  ensureRequestContext,
  readClientIp,
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../infrastructure/operational/request-context';
import { SecurityEventLogger } from '../infrastructure/operational/security-event.logger';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './authenticated-user.interface';
import { AuthenticatedWorkspaceResolver } from './authenticated-workspace-resolver';
import { getAccessTokenSecret } from './jwt-config';
import { IS_PUBLIC_KEY } from './public.decorator';

type JwtAccessPayload = {
  sub: string;
  email?: string;
  sid?: string;
  type?: 'access';
};

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  authSessionId?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly authenticatedWorkspaceResolver: AuthenticatedWorkspaceResolver,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    ensureRequestContext(request, response);
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      this.logAccessDenied(request, 'missing_bearer_token');
      throw new UnauthorizedException('Missing bearer token');
    }

    const resolved = await this.resolveUser(token, request);
    request.user = resolved.user;
    request.authSessionId = resolved.sessionId;
    return true;
  }

  private extractBearerToken(
    authorization: string | string[] | undefined
  ): string | null {
    if (typeof authorization !== 'string') {
      return null;
    }

    const [scheme, token] = authorization.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }

  private async resolveUser(
    token: string,
    request: RequestWithContext
  ): Promise<{ user: AuthenticatedUser; sessionId: string }> {
    let payload: JwtAccessPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: getAccessTokenSecret()
      });
    } catch {
      this.logAccessDenied(request, 'invalid_access_token');
      throw new UnauthorizedException('Invalid access token');
    }

    if (!payload.sub || !payload.sid || payload.type !== 'access') {
      this.logAccessDenied(request, 'invalid_access_token');
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid }
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      this.logAccessDenied(request, 'session_not_active', payload.sub);
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      this.logAccessDenied(request, 'user_not_found', payload.sub);
      throw new UnauthorizedException('User not found');
    }

    return {
      user: await this.authenticatedWorkspaceResolver.buildAuthenticatedUser(
        user
      ),
      sessionId: session.id
    };
  }

  private logAccessDenied(
    request: RequestWithContext,
    reason: string,
    userId?: string
  ): void {
    this.securityEvents.warn('auth.access_denied', {
      requestId: readRequestId(request),
      clientIp: readClientIp(request),
      path: readRequestPath(request),
      reason,
      userId
    });
  }
}
