import type {
  AuthenticatedUser,
  LoginRequest,
  LoginResponse
} from '@personal-erp/contracts';
import {
  ApiRequestError,
  UnauthorizedRequestError
} from '@/shared/api/fetch-json';
import { webEnv } from '@/shared/config/env';

const API_BASE_URL = webEnv.NEXT_PUBLIC_API_BASE_URL;

export async function loginWithPassword(
  input: LoginRequest
): Promise<LoginResponse> {
  return requestAuthJson<LoginResponse>('/auth/login', {
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
      readErrorMessage(responseBody) ?? `Request failed: ${response.status}`;

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
