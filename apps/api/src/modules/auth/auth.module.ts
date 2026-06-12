import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedWorkspaceResolver } from '../../common/auth/authenticated-workspace-resolver';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuthAccountSecurityService } from './infrastructure/services/auth-account-security.service';
import { AuthLinkMaintenanceService } from './infrastructure/services/auth-link-maintenance.service';
import { AuthRateLimitService } from './application/services/auth-rate-limit.service';
import { AuthController } from './auth.controller';
import { AuthSessionService } from './infrastructure/services/auth-session.service';
import { AuthWorkspaceService } from './infrastructure/services/auth-workspace.service';
import { PasswordPolicyService } from './domain/password-policy';
import { WorkspaceBootstrapService } from './infrastructure/services/workspace-bootstrap.service';
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
import { AuthCommandPort } from './application/ports/auth-command.port';
import { AuthCommandAdapter } from './infrastructure/services/auth-command.adapter';
import { AcceptInvitationHandler } from './infrastructure/services/accept-invitation.handler';
import { ChangePasswordHandler } from './infrastructure/services/change-password.handler';
import { ForgotPasswordHandler } from './infrastructure/services/forgot-password.handler';
import { LoginHandler } from './infrastructure/services/login.handler';
import { LogoutHandler } from './infrastructure/services/logout.handler';
import { RefreshSessionHandler } from './infrastructure/services/refresh-session.handler';
import { RegisterHandler } from './infrastructure/services/register.handler';
import { ResendVerificationEmailHandler } from './infrastructure/services/resend-verification-email.handler';
import { ResetPasswordHandler } from './infrastructure/services/reset-password.handler';
import { RevokeOtherSessionHandler } from './infrastructure/services/revoke-other-session.handler';
import { UpdateAccountProfileHandler } from './infrastructure/services/update-account-profile.handler';
import { VerifyEmailHandler } from './infrastructure/services/verify-email.handler';

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
    AuthLinkMaintenanceService,
    PasswordPolicyService,
    WorkspaceBootstrapService,
    RegisterHandler,
    VerifyEmailHandler,
    ResendVerificationEmailHandler,
    AcceptInvitationHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
    LoginHandler,
    RefreshSessionHandler,
    LogoutHandler,
    UpdateAccountProfileHandler,
    ChangePasswordHandler,
    RevokeOtherSessionHandler,
    AuthCommandAdapter,
    {
      provide: AuthCommandPort,
      useExisting: AuthCommandAdapter
    },
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
