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
  allowDemoFallback?: boolean;
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

    const allowDemoFallback =
      options.allowDemoFallback ??
      (options.method == null || options.method === 'GET');

    if (config.demoFallbackEnabled && allowDemoFallback) {
      const warnMsg = '[personal-erp] 데모 폴백 데이터를 사용했습니다: ' + path;
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
        `[personal-erp] ${path} 호출 전에 로그인이 필요합니다.`
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
        `[personal-erp] ${path} 요청 중 세션이 만료되었습니다.`
      ),
      responseBody
    );
  }

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      buildApiErrorMessage(
        responseBody,
        `요청에 실패했습니다: ${response.status}`
      ),
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
    error instanceof Error ? error.message : '알 수 없는 요청 오류';
  return [
    `[personal-erp] ${path} 요청에 실패했습니다.`,
    detail,
    '데모 폴백이 비활성화되어 있습니다.',
    '로컬 개발 중에는 API 서버를 실행하거나 <PERSONAL_ERP_SECRET_DIR>/web.env (또는 apps/web/.env.local)에 NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true 를 설정해 주세요.'
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
