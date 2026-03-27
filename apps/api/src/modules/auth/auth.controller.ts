import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  ForbiddenException,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { getRefreshTokenMaxAgeMs } from '../../common/auth/jwt-config';
import {
  readClientIp,
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { assertAllowedBrowserOrigin } from '../../common/infrastructure/security/browser-boundary';
import { getApiEnv } from '../../config/api-env';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/auth';

function useSecureRefreshCookies(): boolean {
  return new URL(getApiEnv().APP_ORIGIN).protocol === 'https:';
}

function getRefreshCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'strict' as const,
    secure: useSecureRefreshCookies(),
    path: REFRESH_COOKIE_PATH,
    maxAge: getRefreshTokenMaxAgeMs()
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureAllowedCookieOrigin(request);
    const result = await this.authService.login(dto, {
      clientIp: readClientIp(request),
      requestId: readRequestId(request)
    });
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureAllowedCookieOrigin(request);
    const refreshToken = this.readRequiredRefreshTokenCookie(request);
    const result = await this.authService.refresh(
      refreshToken,
      {
        clientIp: readClientIp(request),
        requestId: readRequestId(request)
      }
    );
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureAllowedCookieOrigin(request);
    await this.authService.logout(readOptionalRefreshTokenCookie(request), {
      clientIp: readClientIp(request),
      requestId: readRequestId(request)
    });
    response.setHeader('Cache-Control', 'no-store');
    response.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    return { status: 'logged_out' as const };
  }

  @Get('me')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  private readRequiredRefreshTokenCookie(request: RequestWithContext): string {
    const refreshToken = readOptionalRefreshTokenCookie(request);
    if (refreshToken) {
      return refreshToken;
    }

    this.securityEvents.warn('auth.refresh_failed', {
      requestId: readRequestId(request),
      clientIp: readClientIp(request),
      path: readRequestPath(request),
      reason: 'missing_refresh_token'
    });
    throw new UnauthorizedException('Missing refresh token');
  }

  private ensureAllowedCookieOrigin(request: RequestWithContext): void {
    try {
      assertAllowedBrowserOrigin(request, getApiEnv().CORS_ALLOWED_ORIGINS);
    } catch (error) {
      const requestPath = readRequestPath(request);
      this.securityEvents.warn('auth.browser_origin_blocked', {
        requestId: readRequestId(request),
        clientIp: readClientIp(request),
        path: requestPath,
        origin: readBrowserOriginForAudit(request),
        reason: 'origin_not_allowed'
      });

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Origin not allowed');
    }
  }
}

function readOptionalRefreshTokenCookie(request: Request): string | undefined {
  const refreshToken =
    request.cookies?.[REFRESH_COOKIE_NAME] ??
    readCookieValueFromHeader(request.headers.cookie, REFRESH_COOKIE_NAME);

  return typeof refreshToken === 'string' && refreshToken.trim()
    ? refreshToken
    : undefined;
}
function readCookieValueFromHeader(
  cookieHeader: string | string[] | undefined,
  cookieName: string
): string | undefined {
  if (typeof cookieHeader !== 'string' || !cookieHeader.trim()) {
    return undefined;
  }

  for (const cookiePart of cookieHeader.split(';')) {
    const trimmedPart = cookiePart.trim();
    if (!trimmedPart) {
      continue;
    }

    const separatorIndex = trimmedPart.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const name = trimmedPart.slice(0, separatorIndex).trim();
    if (name !== cookieName) {
      continue;
    }

    const value = trimmedPart.slice(separatorIndex + 1).trim();
    if (!value) {
      return undefined;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}
function readBrowserOriginForAudit(request: Request): string | undefined {
  const originHeader = request.headers.origin;
  if (typeof originHeader === 'string' && originHeader.trim()) {
    return originHeader.trim();
  }

  if (Array.isArray(originHeader)) {
    const first = originHeader[0]?.trim();
    if (first) {
      return first;
    }
  }

  const refererHeader = request.headers.referer;
  const referer =
    typeof refererHeader === 'string'
      ? refererHeader
      : Array.isArray(refererHeader)
        ? refererHeader[0]
        : undefined;

  if (!referer?.trim()) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return referer.trim();
  }
}
