import {
  getStoredAccessToken,
  refreshStoredAccessToken,
  handleUnauthorizedSession
} from '../auth/auth-session-store';
import { webEnv, webRuntime } from '../config/env';

const API_BASE_URL = webEnv.NEXT_PUBLIC_API_BASE_URL;
const browserFetch: typeof fetch = (input, init) => fetch(input, init);

export async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  return fetchJsonWithConfig(
    path,
    fallback,
    {
      apiBaseUrl: API_BASE_URL,
      demoFallbackEnabled: webRuntime.demoFallbackEnabled,
      fetchImpl: browserFetch,
      getAccessToken: getStoredAccessToken,
      refreshAccessToken: refreshStoredAccessToken,
      onUnauthorized: () => {
        handleUnauthorizedSession('unauthorized_response');
      }
    },
    { requireAuth: true }
  );
}

export async function postJson<TResponse, TRequest>(
  path: string,
  body: TRequest,
  fallback: TResponse
): Promise<TResponse> {
  return fetchJsonWithConfig(
    path,
    fallback,
    {
      apiBaseUrl: API_BASE_URL,
      demoFallbackEnabled: webRuntime.demoFallbackEnabled,
      fetchImpl: browserFetch,
      getAccessToken: getStoredAccessToken,
      refreshAccessToken: refreshStoredAccessToken,
      onUnauthorized: () => {
        handleUnauthorizedSession('unauthorized_response');
      }
    },
    {
      requireAuth: true,
      method: 'POST',
      body
    }
  );
}

type FetchJsonConfig = {
  apiBaseUrl: string;
  demoFallbackEnabled: boolean;
  fetchImpl: typeof fetch;
  getAccessToken?: () => string | null;
  refreshAccessToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
};

type FetchJsonOptions = {
  requireAuth?: boolean;
  method?: string;
  body?: unknown;
};

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export class UnauthorizedRequestError extends ApiRequestError {
  constructor(message: string, responseBody?: unknown) {
    super(401, message, responseBody);
    this.name = 'UnauthorizedRequestError';
  }
}

export function isUnauthorizedRequestError(
  error: unknown
): error is UnauthorizedRequestError {
  return error instanceof UnauthorizedRequestError;
}

export async function fetchJsonWithConfig<T>(
  path: string,
  fallback: T,
  config: FetchJsonConfig,
  options: FetchJsonOptions = {}
): Promise<T> {
  try {
    return await sendRequest(path, config, options, true);
  } catch (error) {
    if (isUnauthorizedRequestError(error)) {
      throw error;
    }

    if (config.demoFallbackEnabled) {
      const warnMsg = '[personal-erp] demo fallback data used for ' + path;
      console.warn(warnMsg, error);
      return fallback;
    }

    throw new Error(buildRequestFailureMessage(path, error));
  }
}

async function sendRequest<T>(
  path: string,
  config: FetchJsonConfig,
  options: FetchJsonOptions,
  allowRefresh: boolean
): Promise<T> {
  const headers = new Headers();
  let body: string | undefined;

  if (options.requireAuth) {
    const token = config.getAccessToken?.();
    if (!token) {
      config.onUnauthorized?.();
      throw new UnauthorizedRequestError(
        `[personal-erp] Sign in is required before calling ${path}.`
      );
    }

    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await config.fetchImpl(`${config.apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    next: { revalidate: 0 },
    cache: 'no-store',
    credentials: 'include',
    headers,
    body
  });

  const responseBody = await readResponseBody(response);

  if (response.status === 401 && options.requireAuth && allowRefresh) {
    const refreshedToken = await config.refreshAccessToken?.();
    if (refreshedToken) {
      return sendRequest(path, config, options, false);
    }
  }

  if (response.status === 401) {
    config.onUnauthorized?.();
    throw new UnauthorizedRequestError(
      buildApiErrorMessage(
        responseBody,
        `[personal-erp] Session expired while requesting ${path}.`
      ),
      responseBody
    );
  }

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      buildApiErrorMessage(responseBody, `Request failed: ${response.status}`),
      responseBody
    );
  }

  return responseBody as T;
}

export function buildRequestFailureMessage(
  path: string,
  error: unknown
): string {
  const detail =
    error instanceof Error ? error.message : 'Unknown request error';
  return [
    `[personal-erp] Request failed for ${path}.`,
    detail,
    'Demo fallback is disabled.',
    'Start the API server or set NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true in <PERSONAL_ERP_SECRET_DIR>/web.env (or apps/web/.env.local) during local development.'
  ].join(' ');
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

function buildApiErrorMessage(
  responseBody: unknown,
  fallbackMessage: string
): string {
  const responseMessage = readErrorMessage(responseBody);
  return responseMessage ?? `[personal-erp] ${fallbackMessage}`;
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
