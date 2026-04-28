import type {
  AuthenticatedUser,
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  AuthenticatedWorkspaceListResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SwitchWorkspaceRequest,
  SwitchWorkspaceResponse,
  VerifyEmailRequest,
  VerifyEmailResponse
} from '@personal-erp/contracts';
import {
  ApiRequestError,
  fetchJson,
  postJson,
  UnauthorizedRequestError
} from '../../shared/api/fetch-json';
import { webEnv } from '../../shared/config/env';

const API_BASE_URL = webEnv.NEXT_PUBLIC_API_BASE_URL;

export const authWorkspacesQueryKey = ['auth', 'workspaces'] as const;

export async function loginWithPassword(
  input: LoginRequest
): Promise<LoginResponse> {
  return requestAuthJson<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input
  });
}

export async function registerWithPassword(
  input: RegisterRequest
): Promise<RegisterResponse> {
  return requestAuthJson<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: input
  });
}

export async function verifyEmail(
  input: VerifyEmailRequest
): Promise<VerifyEmailResponse> {
  return requestAuthJson<VerifyEmailResponse>('/auth/verify-email', {
    method: 'POST',
    body: input
  });
}

export async function resendVerificationEmail(
  input: ResendVerificationRequest
): Promise<RegisterResponse> {
  return requestAuthJson<RegisterResponse>('/auth/resend-verification', {
    method: 'POST',
    body: input
  });
}

export async function acceptInvitation(
  input: AcceptInvitationRequest
): Promise<AcceptInvitationResponse> {
  return requestAuthJson<AcceptInvitationResponse>('/auth/accept-invitation', {
    method: 'POST',
    body: input
  });
}

export async function requestPasswordReset(
  input: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> {
  return requestAuthJson<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: input
  });
}

export async function resetPassword(
  input: ResetPasswordRequest
): Promise<ResetPasswordResponse> {
  return requestAuthJson<ResetPasswordResponse>('/auth/reset-password', {
    method: 'POST',
    body: input
  });
}

export async function getCurrentUser(
  accessToken: string
): Promise<AuthenticatedUser> {
  return requestAuthJson<AuthenticatedUser>('/auth/me', {
    method: 'GET',
    accessToken
  });
}

export function getAccessibleWorkspaces() {
  return fetchJson<AuthenticatedWorkspaceListResponse>('/auth/workspaces', {
    items: []
  });
}

export function switchCurrentWorkspace(input: SwitchWorkspaceRequest) {
  return postJson<SwitchWorkspaceResponse, SwitchWorkspaceRequest>(
    '/auth/current-workspace',
    input,
    {
      user: {
        id: '',
        email: '',
        name: '',
        currentWorkspace: null
      },
      workspaces: []
    }
  );
}

export async function refreshSession(): Promise<LoginResponse> {
  return requestAuthJson<LoginResponse>('/auth/refresh', {
    method: 'POST'
  });
}

export async function logoutSession(): Promise<void> {
  await requestAuthJson<{ status: 'logged_out' }>('/auth/logout', {
    method: 'POST'
  });
}

type AuthRequestOptions = {
  method: 'GET' | 'POST';
  accessToken?: string;
  body?: unknown;
};

async function requestAuthJson<TResponse>(
  path: string,
  options: AuthRequestOptions
): Promise<TResponse> {
  const headers = new Headers();

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    headers,
    body,
    cache: 'no-store',
    credentials: 'include'
  });

  const responseBody = await readResponseBody(response);
  if (!response.ok) {
    const message =
      readErrorMessage(responseBody) ??
      `요청에 실패했습니다: ${response.status}`;

    if (response.status === 401) {
      throw new UnauthorizedRequestError(message, responseBody);
    }

    throw new ApiRequestError(response.status, message, responseBody);
  }

  return responseBody as TResponse;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readErrorMessage(responseBody: unknown): string | null {
  if (typeof responseBody === 'string' && responseBody.trim()) {
    return responseBody.trim();
  }

  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'message' in responseBody
  ) {
    const message = responseBody.message;

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }

    if (Array.isArray(message) && message.length > 0) {
      return message.join(', ');
    }
  }

  return null;
}
