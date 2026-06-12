import { Injectable } from '@nestjs/common';
import type {
  AcceptInvitationRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  UpdateAccountProfileRequest,
  VerifyEmailRequest
} from '@personal-erp/contracts';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import type { RequestWithContext } from '../../../../common/infrastructure/operational/request-context';
import type { AuthRequestContext } from '../../application/models/auth.types';
import { AuthCommandPort } from '../../application/ports/auth-command.port';
import { AcceptInvitationHandler } from './accept-invitation.handler';
import { ChangePasswordHandler } from './change-password.handler';
import { ForgotPasswordHandler } from './forgot-password.handler';
import { LoginHandler } from './login.handler';
import { LogoutHandler } from './logout.handler';
import { RefreshSessionHandler } from './refresh-session.handler';
import { RegisterHandler } from './register.handler';
import { ResendVerificationEmailHandler } from './resend-verification-email.handler';
import { ResetPasswordHandler } from './reset-password.handler';
import { RevokeOtherSessionHandler } from './revoke-other-session.handler';
import { UpdateAccountProfileHandler } from './update-account-profile.handler';
import { VerifyEmailHandler } from './verify-email.handler';

@Injectable()
export class AuthCommandAdapter extends AuthCommandPort {
  constructor(
    private readonly registerHandler: RegisterHandler,
    private readonly verifyEmailHandler: VerifyEmailHandler,
    private readonly resendVerificationEmailHandler: ResendVerificationEmailHandler,
    private readonly acceptInvitationHandler: AcceptInvitationHandler,
    private readonly forgotPasswordHandler: ForgotPasswordHandler,
    private readonly resetPasswordHandler: ResetPasswordHandler,
    private readonly loginHandler: LoginHandler,
    private readonly refreshSessionHandler: RefreshSessionHandler,
    private readonly logoutHandler: LogoutHandler,
    private readonly updateAccountProfileHandler: UpdateAccountProfileHandler,
    private readonly changePasswordHandler: ChangePasswordHandler,
    private readonly revokeOtherSessionHandler: RevokeOtherSessionHandler
  ) {
    super();
  }

  register(input: RegisterRequest, context: AuthRequestContext) {
    return this.registerHandler.execute(input, context);
  }

  verifyEmail(input: VerifyEmailRequest, context: AuthRequestContext) {
    return this.verifyEmailHandler.execute(input, context);
  }

  resendVerificationEmail(
    input: ResendVerificationRequest,
    context: AuthRequestContext
  ) {
    return this.resendVerificationEmailHandler.execute(input, context);
  }

  acceptInvitation(
    input: AcceptInvitationRequest,
    context: AuthRequestContext
  ) {
    return this.acceptInvitationHandler.execute(input, context);
  }

  forgotPassword(input: ForgotPasswordRequest, context: AuthRequestContext) {
    return this.forgotPasswordHandler.execute(input, context);
  }

  resetPassword(input: ResetPasswordRequest, context: AuthRequestContext) {
    return this.resetPasswordHandler.execute(input, context);
  }

  login(input: LoginRequest, context: AuthRequestContext) {
    return this.loginHandler.execute(input, context);
  }

  refreshSession(refreshToken: string, context: AuthRequestContext) {
    return this.refreshSessionHandler.execute(refreshToken, context);
  }

  logout(refreshToken: string | undefined, context: AuthRequestContext) {
    return this.logoutHandler.execute(refreshToken, context);
  }

  updateAccountProfile(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    input: UpdateAccountProfileRequest
  ) {
    return this.updateAccountProfileHandler.execute(
      user,
      workspace,
      request as RequestWithContext,
      input
    );
  }

  changePassword(
    user: { id: string; email: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    currentSessionId: string,
    input: ChangePasswordRequest
  ) {
    return this.changePasswordHandler.execute(
      user,
      workspace,
      request as RequestWithContext,
      currentSessionId,
      input
    );
  }

  revokeOtherSession(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    currentSessionId: string,
    targetSessionId: string
  ) {
    return this.revokeOtherSessionHandler.execute(
      user,
      workspace,
      request as RequestWithContext,
      currentSessionId,
      targetSessionId
    );
  }
}
