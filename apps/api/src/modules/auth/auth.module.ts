import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedWorkspaceResolver } from '../../common/auth/authenticated-workspace-resolver';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuthAccountSecurityService } from './auth-account-security.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthController } from './auth.controller';
import { AuthSessionService } from './auth-session.service';
import { AuthWorkspaceService } from './auth-workspace.service';
import { WorkspaceBootstrapService } from './workspace-bootstrap.service';
import { AcceptInvitationUseCase } from './application/use-cases/accept-invitation.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { ResendVerificationEmailUseCase } from './application/use-cases/resend-verification-email.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { RevokeOtherSessionUseCase } from './application/use-cases/revoke-other-session.use-case';
import { UpdateAccountProfileUseCase } from './application/use-cases/update-account-profile.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthenticatedWorkspaceResolver,
    AuthRateLimitService,
    AuthSessionService,
    AuthWorkspaceService,
    AuthAccountSecurityService,
    WorkspaceBootstrapService,
    JwtAuthGuard,
    // 유스케이스
    RegisterUseCase,
    VerifyEmailUseCase,
    ResendVerificationEmailUseCase,
    AcceptInvitationUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    UpdateAccountProfileUseCase,
    ChangePasswordUseCase,
    RevokeOtherSessionUseCase,
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard
    }
  ],
  exports: [
    JwtModule,
    AuthenticatedWorkspaceResolver,
    WorkspaceBootstrapService
  ]
})
export class AuthModule {}
