import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  AccountProfileItem,
  ChangePasswordRequest,
  ChangePasswordResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
  RevokeAccountSessionResponse,
  UpdateAccountProfileRequest,
  VerifyEmailRequest,
  VerifyEmailResponse
} from '@personal-erp/contracts';
import type { RequestAuditContext } from '../../../../common/application/models/request-audit-context';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import type {
  AuthRequestContext,
  AuthSessionResult
} from '../models/auth.types';

export abstract class AuthCommandPort {
  abstract register(
    input: RegisterRequest,
    context: AuthRequestContext
  ): Promise<RegisterResponse>;

  abstract verifyEmail(
    input: VerifyEmailRequest,
    context: AuthRequestContext
  ): Promise<VerifyEmailResponse>;

  abstract resendVerificationEmail(
    input: ResendVerificationRequest,
    context: AuthRequestContext
  ): Promise<RegisterResponse>;

  abstract acceptInvitation(
    input: AcceptInvitationRequest,
    context: AuthRequestContext
  ): Promise<AcceptInvitationResponse>;

  abstract forgotPassword(
    input: ForgotPasswordRequest,
    context: AuthRequestContext
  ): Promise<ForgotPasswordResponse>;

  abstract resetPassword(
    input: ResetPasswordRequest,
    context: AuthRequestContext
  ): Promise<ResetPasswordResponse>;

  abstract login(
    input: LoginRequest,
    context: AuthRequestContext
  ): Promise<AuthSessionResult>;

  abstract refreshSession(
    refreshToken: string,
    context: AuthRequestContext
  ): Promise<AuthSessionResult>;

  abstract logout(
    refreshToken: string | undefined,
    context: AuthRequestContext
  ): Promise<void>;

  abstract updateAccountProfile(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    input: UpdateAccountProfileRequest
  ): Promise<AccountProfileItem>;

  abstract changePassword(
    user: { id: string; email: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    currentSessionId: string,
    input: ChangePasswordRequest
  ): Promise<ChangePasswordResponse>;

  abstract revokeOtherSession(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestAuditContext,
    currentSessionId: string,
    targetSessionId: string
  ): Promise<RevokeAccountSessionResponse>;
}
