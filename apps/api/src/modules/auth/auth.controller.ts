import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  ForbiddenException,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentSessionId } from '../../common/auth/current-session-id.decorator';
import { getRefreshTokenMaxAgeMs } from '../../common/auth/jwt-config';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  assertWorkspaceActionAllowed,
  readAllowedWorkspaceRoles,
  type WorkspaceAction
} from '../../common/auth/workspace-action.policy';
import {
  readClientIp,
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { assertAllowedBrowserOrigin } from '../../common/infrastructure/security/browser-boundary';
import { getApiEnv } from '../../config/api-env';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { AuthAccountSecurityService } from './auth-account-security.service';
import { AuthWorkspaceService } from './auth-workspace.service';
import { AcceptInvitationUseCase } from './application/use-cases/accept-invitation.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { ResendVerificationEmailUseCase } from './application/use-cases/resend-verification-email.use-case';
import { RevokeOtherSessionUseCase } from './application/use-cases/revoke-other-session.use-case';
import { UpdateAccountProfileUseCase } from './application/use-cases/update-account-profile.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { LoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SwitchWorkspaceDto } from './dto/switch-workspace.dto';
import { UpdateAccountProfileDto } from './dto/update-account-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

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
    private readonly authAccountSecurityService: AuthAccountSecurityService,
    private readonly authWorkspaceService: AuthWorkspaceService,
    private readonly registerUseCase: RegisterUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationEmailUseCase: ResendVerificationEmailUseCase,
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly updateAccountProfileUseCase: UpdateAccountProfileUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly revokeOtherSessionUseCase: RevokeOtherSessionUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Public()
  @HttpCode(200)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureAllowedCookieOrigin(request);
    const result = await this.registerUseCase.execute(dto, {
      clientIp: readClientIp(request),
      requestId: readRequestId(request)
    });
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }

  @Public()
  @HttpCode(200)
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureAllowedCookieOrigin(request);
    const result = await this.verifyEmailUseCase.execute(dto, {
      clientIp: readClientIp(request),
      requestId: readRequestId(request)
    });
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }

  @Public()
  @HttpCode(200)
  @Post('resend-verification')
  async resendVerificationEmail(
    @Body() dto: ResendVerificationDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureAllowedCookieOrigin(request);
    const result = await this.resendVerificationEmailUseCase.execute(dto, {
      clientIp: readClientIp(request),
      requestId: readRequestId(request)
    });
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }

  @Public()
  @HttpCode(200)
  @Post('accept-invitation')
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureAllowedCookieOrigin(request);
    const result = await this.acceptInvitationUseCase.execute(dto, {
      clientIp: readClientIp(request),
      requestId: readRequestId(request)
    });
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureAllowedCookieOrigin(request);
    const result = await this.loginUseCase.execute(dto, {
      clientIp: readClientIp(request),
      requestId: readRequestId(request)
    });
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      getRefreshCookieOptions()
    );
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
    const result = await this.refreshSessionUseCase.execute(refreshToken, {
      clientIp: readClientIp(request),
      requestId: readRequestId(request)
    });
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      getRefreshCookieOptions()
    );
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
    await this.logoutUseCase.execute(readOptionalRefreshTokenCookie(request), {
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

  @Get('workspaces')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  getWorkspaces(@CurrentUser() user: AuthenticatedUser) {
    return this.authWorkspaceService.listWorkspaces(user);
  }

  @Post('current-workspace')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  async switchCurrentWorkspace(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string | undefined,
    @Body() dto: SwitchWorkspaceDto
  ) {
    return this.authWorkspaceService.switchCurrentWorkspace(
      user,
      currentSessionId,
      dto,
      {
        clientIp: readClientIp(request),
        requestId: readRequestId(request)
      }
    );
  }

  @Get('account-security')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  async getAccountSecurity(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId?: string
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'account_security.read',
      request,
      workspace
    });

    const response = await this.authAccountSecurityService.getAccountSecurity(
      user,
      workspace,
      currentSessionId ?? ''
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'account_security.read',
      request,
      workspace,
      details: {
        sessionCount: response.sessions.length
      }
    });

    return response;
  }

  @Patch('account-profile')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  async updateAccountProfile(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAccountProfileDto
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'account_profile.update',
      request,
      workspace
    });

    const response = await this.updateAccountProfileUseCase.execute(
      user,
      workspace,
      request,
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'account_profile.update',
      request,
      workspace,
      persist: false,
      details: {
        userId: response.id
      }
    });

    return response;
  }

  @Post('change-password')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  async changePassword(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string | undefined,
    @Body() dto: ChangePasswordDto
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'account_security.change_password',
      request,
      workspace
    });

    const response = await this.changePasswordUseCase.execute(
      user,
      workspace,
      request,
      currentSessionId ?? '',
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'account_security.change_password',
      request,
      workspace,
      persist: false,
      details: {
        userId: user.id
      }
    });

    return response;
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async revokeOtherSession(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string | undefined,
    @Param('sessionId') sessionId: string
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'account_security.revoke_session',
      request,
      workspace
    });

    const response = await this.revokeOtherSessionUseCase.execute(
      user,
      workspace,
      request,
      currentSessionId ?? '',
      sessionId
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'account_security.revoke_session',
      request,
      workspace,
      persist: false,
      details: {
        sessionId
      }
    });

    return response;
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

  private async assertAllowed(input: {
    action: WorkspaceAction;
    request: RequestWithContext;
    workspace: ReturnType<typeof requireCurrentWorkspace>;
  }): Promise<void> {
    try {
      assertWorkspaceActionAllowed(
        input.workspace.membershipRole,
        input.action
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: input.action,
          request: input.request,
          workspace: input.workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles(input.action).join(',')
          }
        });
      }

      throw error;
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
