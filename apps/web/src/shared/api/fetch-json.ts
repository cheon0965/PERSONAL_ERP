import {
  getStoredAccessToken,
  refreshStoredAccessToken,
  handleUnauthorizedSession
} from '../auth/auth-session-store';
import { webEnv, webRuntime } from '../config/env';

const API_BASE_URL = webEnv.NEXT_PUBLIC_API_BASE_URL;
const browserFetch: typeof fetch = (input, init) => fetch(input, init);
const REQUEST_ID_HEADER = 'x-request-id';
const DIAGNOSTIC_RESPONSE_BODY_LIMIT = 2000;

type ApiErrorDiagnostics = {
  method?: string;
  path?: string;
  requestId?: string;
  errorCode?: string;
  statusText?: string;
  serverError?: string;
  validationMessages?: string[];
  technicalMessage?: string;
  timestamp?: string;
};

type ErrorFeedbackValue = {
  severity: 'error';
  message: string;
  diagnostics?: string;
};

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

export async function postFormData<TResponse>(
  path: string,
  formData: FormData,
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
      formData
    }
  );
}

export async function patchJson<TResponse, TRequest>(
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
      method: 'PATCH',
      body
    }
  );
}

export async function deleteJson<TResponse>(
  path: string,
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
      method: 'DELETE'
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
  formData?: FormData;
  allowDemoFallback?: boolean;
};

export class ApiRequestError extends Error {
  public readonly userMessage: string;
  public readonly method?: string;
  public readonly path?: string;
  public readonly requestId?: string;
  public readonly errorCode?: string;
  public readonly statusText?: string;
  public readonly serverError?: string;
  public readonly validationMessages?: string[];
  public readonly technicalMessage?: string;
  public readonly timestamp?: string;

  constructor(
    public readonly status: number,
    message: string,
    public readonly responseBody?: unknown,
    diagnostics: ApiErrorDiagnostics = {}
  ) {
    super(formatApiErrorMessage(message, diagnostics));
    this.name = 'ApiRequestError';
    this.userMessage = message;
    this.method = diagnostics.method;
    this.path = diagnostics.path;
    this.requestId = diagnostics.requestId;
    this.errorCode = diagnostics.errorCode;
    this.statusText = diagnostics.statusText;
    this.serverError = diagnostics.serverError;
    this.validationMessages = diagnostics.validationMessages;
    this.technicalMessage = diagnostics.technicalMessage;
    this.timestamp = diagnostics.timestamp;
  }
}

export class UnauthorizedRequestError extends ApiRequestError {
  constructor(
    message: string,
    responseBody?: unknown,
    diagnostics: ApiErrorDiagnostics = {}
  ) {
    super(401, message, responseBody, {
      errorCode: 'AUTH_REQUIRED',
      ...diagnostics
    });
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

    // 데모 폴백은 조회성 요청에만 기본 허용한다.
    // mutation 실패를 성공처럼 꾸미면 실제 운영 데이터와 화면 상태가 갈라질 수 있다.
    const allowDemoFallback =
      options.allowDemoFallback ??
      (options.method == null || options.method === 'GET');

    if (config.demoFallbackEnabled && allowDemoFallback) {
      console.warn(
        '[personal-erp] 데모 폴백 데이터를 사용했습니다.',
        path,
        error
      );
      return fallback;
    }

    if (error instanceof ApiRequestError) {
      throw error;
    }

    throw new ApiRequestError(
      0,
      '서버와 연결하지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.',
      null,
      {
        method: readRequestMethod(options),
        path,
        errorCode: 'NETWORK_REQUEST_FAILED',
        technicalMessage: buildRequestFailureMessage(path, error),
        timestamp: new Date().toISOString()
      }
    );
  }
}

async function sendRequest<T>(
  path: string,
  config: FetchJsonConfig,
  options: FetchJsonOptions,
  allowRefresh: boolean
): Promise<T> {
  const headers = new Headers();
  let body: BodyInit | undefined;

  if (options.requireAuth) {
    const token = config.getAccessToken?.();
    if (!token) {
      config.onUnauthorized?.();
      throw new UnauthorizedRequestError(
        '로그인이 필요합니다. 다시 로그인해 주세요.',
        null,
        {
          method: readRequestMethod(options),
          path,
          technicalMessage: `[personal-erp] ${path} 호출 전에 로그인이 필요합니다.`
        }
      );
    }

    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body !== undefined && options.formData !== undefined) {
    throw new Error('JSON body와 FormData는 동시에 보낼 수 없습니다.');
  }

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  if (options.formData !== undefined) {
    body = options.formData;
  }

  const method = readRequestMethod(options);
  const response = await config.fetchImpl(`${config.apiBaseUrl}${path}`, {
    method,
    next: { revalidate: 0 },
    cache: 'no-store',
    credentials: 'include',
    headers,
    body
  });

  const responseBody = await readResponseBody(response);

  // access token 만료는 한 번만 refresh 후 재시도한다.
  // refresh 재사용이나 서버 거부가 발생하면 세션 정리 흐름으로 넘겨 무한 재시도를 막는다.
  if (response.status === 401 && options.requireAuth && allowRefresh) {
    const refreshedToken = await config.refreshAccessToken?.();
    if (refreshedToken) {
      return sendRequest(path, config, options, false);
    }
  }

  if (response.status === 401) {
    config.onUnauthorized?.();
    throw createApiRequestErrorFromResponse(response, path, responseBody, {
      unauthorized: true,
      method
    });
  }

  if (!response.ok) {
    throw createApiRequestErrorFromResponse(response, path, responseBody, {
      method
    });
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
    '로컬 개발 중에는 서비스 서버를 실행하거나 <PERSONAL_ERP_SECRET_DIR>/web.env (또는 apps/web/.env.local)에 NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true 를 설정해 주세요.'
  ].join(' ');
}

export function createApiRequestErrorFromResponse(
  response: Response,
  path: string,
  responseBody: unknown,
  options: { unauthorized?: boolean; method?: string } = {}
) {
  const rawMessage = readErrorMessage(responseBody);
  const validationMessages = readErrorMessages(responseBody);
  const requestId = readRequestId(response, responseBody);
  const errorCode = readErrorCode(response.status, responseBody);
  // 화면에는 사용자가 취할 행동을 먼저 보여주고, 원본 서버 메시지는 diagnostics에 보존한다.
  // 운영 중에는 사용자가 requestId를 전달하고 개발자가 접힌 진단 정보로 원인을 추적한다.
  const userMessage = buildApiErrorMessage(responseBody, {
    status: response.status,
    path,
    rawMessage,
    unauthorized: options.unauthorized === true
  });
  const diagnostics = {
    method: options.method,
    path,
    requestId,
    errorCode,
    statusText: response.statusText,
    serverError: readResponseError(responseBody),
    validationMessages: validationMessages ?? undefined,
    technicalMessage: buildTechnicalMessage(
      response,
      rawMessage,
      validationMessages
    ),
    timestamp: readResponseTimestamp(responseBody) ?? new Date().toISOString()
  };

  if (options.unauthorized || response.status === 401) {
    return new UnauthorizedRequestError(userMessage, responseBody, diagnostics);
  }

  return new ApiRequestError(
    response.status,
    userMessage,
    responseBody,
    diagnostics
  );
}

export function formatErrorMessage(error: unknown, fallbackMessage: string) {
  return readErrorUserMessage(error, fallbackMessage);
}

export function readErrorUserMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiRequestError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    return sanitizeClientErrorMessage(error.message, fallbackMessage);
  }

  return fallbackMessage;
}

export function readErrorDiagnostics(error: unknown): string | null {
  if (!(error instanceof ApiRequestError)) {
    return null;
  }

  const validationDiagnostics = (error.validationMessages ?? []).map(
    (message, index) =>
      formatDiagnosticLine(
        `검증 항목 ${index + 1}`,
        formatValidationDiagnosticMessage(message)
      )
  );
  const responseBody = formatDiagnosticValue(error.responseBody);

  return [
    formatDiagnosticLine('오류 코드', error.errorCode),
    formatDiagnosticLine('HTTP 상태', formatDiagnosticHttpStatus(error)),
    formatDiagnosticLine('요청 메서드', error.method),
    formatDiagnosticLine('요청 경로', error.path),
    formatDiagnosticLine('요청번호', error.requestId),
    formatDiagnosticLine('서버 오류 항목', error.serverError),
    formatDiagnosticLine('사용자 표시 메시지', error.userMessage),
    ...validationDiagnostics,
    formatDiagnosticLine('기술 메시지', error.technicalMessage),
    formatDiagnosticLine('응답 시각', error.timestamp),
    responseBody ? formatDiagnosticLine('원본 응답 본문', responseBody) : null
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n');
}

export function buildErrorFeedback(
  error: unknown,
  fallbackMessage: string
): ErrorFeedbackValue {
  return {
    severity: 'error',
    message: buildFeedbackUserMessage(error, fallbackMessage),
    diagnostics: readErrorDiagnostics(error) ?? undefined
  };
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
  input: {
    status: number;
    path: string;
    rawMessage: string | null;
    unauthorized: boolean;
  }
): string {
  const responseMessage = input.rawMessage ?? readErrorMessage(responseBody);
  const validationMessages = readErrorMessages(responseBody);

  if (Array.isArray(validationMessages)) {
    return buildValidationMessage(validationMessages);
  }

  if (responseMessage) {
    const translated = translateKnownApiMessage(responseMessage);
    if (translated) {
      return translated;
    }

    if (!looksInternalMessage(responseMessage)) {
      return responseMessage;
    }
  }

  if (input.unauthorized || input.status === 401) {
    return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  }

  return readStatusFallbackMessage(input.status);
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

function readErrorMessages(responseBody: unknown): string[] | null {
  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'message' in responseBody
  ) {
    const message = responseBody.message;
    if (Array.isArray(message) && message.length > 0) {
      return message
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return null;
}

function readResponseError(responseBody: unknown): string | undefined {
  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'error' in responseBody &&
    typeof responseBody.error === 'string'
  ) {
    return responseBody.error.trim() || undefined;
  }

  return undefined;
}

function readResponseTimestamp(responseBody: unknown): string | undefined {
  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'timestamp' in responseBody &&
    typeof responseBody.timestamp === 'string'
  ) {
    return responseBody.timestamp.trim() || undefined;
  }

  return undefined;
}

function readRequestId(response: Response, responseBody: unknown) {
  const headerRequestId = response.headers.get(REQUEST_ID_HEADER)?.trim();
  if (headerRequestId) {
    return headerRequestId;
  }

  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'requestId' in responseBody &&
    typeof responseBody.requestId === 'string'
  ) {
    return responseBody.requestId.trim() || undefined;
  }

  return undefined;
}

function readErrorCode(status: number, responseBody: unknown) {
  if (responseBody && typeof responseBody === 'object') {
    if (
      'errorCode' in responseBody &&
      typeof responseBody.errorCode === 'string' &&
      responseBody.errorCode.trim()
    ) {
      return responseBody.errorCode.trim();
    }

    if (
      'code' in responseBody &&
      typeof responseBody.code === 'string' &&
      responseBody.code.trim()
    ) {
      return responseBody.code.trim();
    }
  }

  switch (status) {
    case 400:
      return 'REQUEST_INVALID';
    case 401:
      return 'AUTH_REQUIRED';
    case 403:
      return 'ACCESS_DENIED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 409:
      return 'BUSINESS_RULE_CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'SERVER_ERROR' : `HTTP_${status}`;
  }
}

function formatApiErrorMessage(
  message: string,
  diagnostics: ApiErrorDiagnostics
) {
  const details = [
    diagnostics.errorCode,
    diagnostics.requestId ? `요청번호 ${diagnostics.requestId}` : null
  ].filter((item): item is string => Boolean(item));

  return details.length > 0
    ? `${message} (진단: ${details.join(' · ')})`
    : message;
}

function buildTechnicalMessage(
  response: Response,
  rawMessage: string | null,
  validationMessages: string[] | null
) {
  if (validationMessages && validationMessages.length > 0) {
    return validationMessages.join(' | ');
  }

  return rawMessage ?? response.statusText ?? `HTTP ${response.status}`;
}

function readRequestMethod(options: FetchJsonOptions) {
  return options.method ?? 'GET';
}

function buildFeedbackUserMessage(error: unknown, fallbackMessage: string) {
  const userMessage = readErrorUserMessage(error, fallbackMessage);
  const actionMessage = fallbackMessage.trim();

  if (
    !(error instanceof ApiRequestError) ||
    !actionMessage ||
    userMessage === actionMessage ||
    isGenericActionMessage(actionMessage)
  ) {
    return userMessage;
  }

  return `${actionMessage} ${userMessage}`;
}

function isGenericActionMessage(message: string) {
  return (
    message === '작업을 완료하지 못했습니다.' ||
    message === '요청을 완료하지 못했습니다.' ||
    message === '데이터를 불러오지 못했습니다.'
  );
}

function formatDiagnosticLine(label: string, value: string | undefined | null) {
  if (!value) {
    return null;
  }

  return `${label}: ${value}`;
}

function formatDiagnosticHttpStatus(error: ApiRequestError) {
  if (error.status === 0) {
    return '네트워크 요청 실패';
  }

  return [String(error.status), error.statusText].filter(Boolean).join(' ');
}

function formatValidationDiagnosticMessage(message: string) {
  const field = readValidationFieldName(message);
  const fieldLabel = field ? readFieldLabel(field) : null;

  if (!field || !fieldLabel) {
    return message;
  }

  return `${fieldLabel} (${field}) - ${message}`;
}

function readValidationFieldName(message: string) {
  const match = message.match(
    /^(.+?) (?:must|should|is|has|cannot|can only|can not)\b/i
  );
  return match?.[1]?.trim();
}

function formatDiagnosticValue(value: unknown) {
  if (value == null) {
    return null;
  }

  const raw =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  if (!raw) {
    return null;
  }

  return raw.length > DIAGNOSTIC_RESPONSE_BODY_LIMIT
    ? `${raw.slice(0, DIAGNOSTIC_RESPONSE_BODY_LIMIT)}...`
    : raw;
}

function buildValidationMessage(messages: string[] | null) {
  const translatedMessages = (messages ?? [])
    .map(translateValidationMessage)
    .filter(Boolean)
    .slice(0, 3);
  const hiddenMessageCount = Math.max(
    (messages?.length ?? 0) - translatedMessages.length,
    0
  );

  if (translatedMessages.length === 0) {
    return '입력값을 확인해 주세요.';
  }

  const suffix =
    hiddenMessageCount > 0
      ? ` 외 ${hiddenMessageCount}개 항목도 함께 확인해 주세요.`
      : '';

  return `입력값을 확인해 주세요. ${translatedMessages.join(' ')}${suffix}`;
}

function sanitizeClientErrorMessage(message: string, fallbackMessage: string) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return fallbackMessage;
  }

  // 개발자용 단서를 API가 포함하더라도 화면에는 먼저 행동 가능한 사용자 문장을 보여준다.
  // 원본 단서는 diagnostics에 남겨 접힌 상세 영역에서 확인하게 한다.
  const translated = translateKnownApiMessage(trimmedMessage);
  if (translated) {
    return translated;
  }

  return looksInternalMessage(trimmedMessage)
    ? fallbackMessage
    : trimmedMessage;
}

function translateKnownApiMessage(message: string) {
  const normalized = message.trim();

  const exactMessage = exactUserMessageMap[normalized];
  if (exactMessage) {
    return exactMessage;
  }

  const notFoundMatch = normalized.match(/^(.+?) not found\.?$/i);
  if (notFoundMatch) {
    const resourceLabel = readResourceLabel(notFoundMatch[1] ?? '');
    return resourceLabel
      ? `선택한 ${withObjectParticle(resourceLabel)} 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.`
      : '요청한 데이터를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.';
  }

  if (/^Only .+ can /i.test(normalized)) {
    return '현재 권한으로는 이 작업을 진행할 수 없습니다. 필요한 역할 권한을 확인해 주세요.';
  }

  if (/^Invalid month format/i.test(normalized)) {
    return '월은 YYYY-MM 형식으로 입력해 주세요.';
  }

  if (/^Accounting period status cannot transition/i.test(normalized)) {
    return '현재 운영 기간 상태에서는 이 작업을 진행할 수 없습니다. 화면을 새로고침한 뒤 운영 기간 상태를 확인해 주세요.';
  }

  return null;
}

function translateValidationMessage(message: string) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return '';
  }

  const knownMessage = translateKnownApiMessage(trimmedMessage);
  if (knownMessage) {
    return knownMessage;
  }

  if (containsKorean(trimmedMessage) && !looksInternalMessage(trimmedMessage)) {
    return trimmedMessage;
  }

  const emailMatch = trimmedMessage.match(/^(.+?) must be an email$/i);
  if (emailMatch) {
    return `${readFieldLabel(emailMatch[1] ?? '')} 형식이 올바르지 않습니다.`;
  }

  const stringMatch = trimmedMessage.match(/^(.+?) must be a string$/i);
  if (stringMatch) {
    return `${readFieldLabel(stringMatch[1] ?? '')} 항목을 입력해 주세요.`;
  }

  const numberMatch = trimmedMessage.match(
    /^(.+?) must be (?:an integer|a number|a boolean|string|one of the following values).*$/i
  );
  if (numberMatch) {
    return `${readFieldLabel(numberMatch[1] ?? '')} 값을 확인해 주세요.`;
  }

  const requiredMatch = trimmedMessage.match(/^(.+?) should not be empty$/i);
  if (requiredMatch) {
    return `${readFieldLabel(requiredMatch[1] ?? '')} 항목을 입력해 주세요.`;
  }

  const booleanTrueMatch = trimmedMessage.match(/^(.+?) must be true$/i);
  if (booleanTrueMatch) {
    return `${readFieldLabel(booleanTrueMatch[1] ?? '')} 항목을 확인해 주세요.`;
  }

  const uuidMatch = trimmedMessage.match(/^(.+?) must be a UUID$/i);
  if (uuidMatch) {
    return `${readFieldLabel(uuidMatch[1] ?? '')} 항목을 다시 선택해 주세요.`;
  }

  const dateStringMatch = trimmedMessage.match(
    /^(.+?) must be a valid ISO 8601 date string$/i
  );
  if (dateStringMatch) {
    return `${readFieldLabel(dateStringMatch[1] ?? '')} 날짜 형식을 확인해 주세요.`;
  }

  const minLengthMatch = trimmedMessage.match(
    /^(.+?) must be longer than or equal to (\d+) characters$/i
  );
  if (minLengthMatch) {
    return `${readFieldLabel(minLengthMatch[1] ?? '')}은 ${minLengthMatch[2]}자 이상 입력해 주세요.`;
  }

  const maxLengthMatch = trimmedMessage.match(
    /^(.+?) must be shorter than or equal to (\d+) characters$/i
  );
  if (maxLengthMatch) {
    return `${readFieldLabel(maxLengthMatch[1] ?? '')}은 ${maxLengthMatch[2]}자 이하로 입력해 주세요.`;
  }

  const minValueMatch = trimmedMessage.match(
    /^(.+?) must not be less than (\d+)$/i
  );
  if (minValueMatch) {
    return `${readFieldLabel(minValueMatch[1] ?? '')}은 ${minValueMatch[2]} 이상이어야 합니다.`;
  }

  const maxValueMatch = trimmedMessage.match(
    /^(.+?) must not be greater than (\d+)$/i
  );
  if (maxValueMatch) {
    return `${readFieldLabel(maxValueMatch[1] ?? '')}은 ${maxValueMatch[2]} 이하이어야 합니다.`;
  }

  const patternMatch = trimmedMessage.match(
    /^(.+?) must match .+ regular expression$/i
  );
  if (patternMatch) {
    return `${readFieldLabel(patternMatch[1] ?? '')} 형식을 확인해 주세요.`;
  }

  return '일부 입력값의 형식이 올바르지 않습니다.';
}

function readStatusFallbackMessage(status: number) {
  switch (status) {
    case 400:
      return '입력값이나 요청 조건이 올바르지 않습니다. 표시된 항목을 확인해 주세요.';
    case 401:
      return '로그인이 필요합니다. 다시 로그인해 주세요.';
    case 403:
      return '현재 계정 권한으로는 이 작업을 진행할 수 없습니다. 필요한 역할 권한을 확인해 주세요.';
    case 404:
      return '요청한 데이터를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.';
    case 409:
      return '현재 데이터 상태와 맞지 않아 작업을 완료하지 못했습니다. 화면을 새로고침한 뒤 상태를 확인해 주세요.';
    case 429:
      return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    default:
      return status >= 500
        ? '서버에서 작업을 완료하지 못했습니다. 잠시 후 다시 시도하거나 요청번호를 관리자에게 전달해 주세요.'
        : '요청을 완료하지 못했습니다. 입력값과 화면 상태를 확인해 주세요.';
  }
}

function looksInternalMessage(message: string) {
  const normalized = message.trim();

  return (
    normalized.includes('[personal-erp]') ||
    normalized.includes('Prisma') ||
    normalized.includes('P200') ||
    normalized.includes('ECONN') ||
    normalized.includes('NEXT_PUBLIC_') ||
    normalized.includes('<PERSONAL_ERP_SECRET_DIR>') ||
    /^Request failed/i.test(normalized) ||
    /^Invalid .*token$/i.test(normalized) ||
    /^Invalid month format/i.test(normalized) ||
    /^Expired token$/i.test(normalized) ||
    /^Missing bearer token$/i.test(normalized) ||
    /^Origin not allowed$/i.test(normalized) ||
    /^Cannot /.test(normalized) ||
    /^Could not /.test(normalized) ||
    /^Created .* could not be reloaded/i.test(normalized) ||
    /^Only .+ can /i.test(normalized) ||
    /^This posting policy requires/i.test(normalized) ||
    /^Accounting period status cannot transition/i.test(normalized) ||
    /^[A-Za-z]+(?: [A-Za-z]+)* not found\.?$/i.test(normalized)
  );
}

function containsKorean(message: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(message);
}

function withObjectParticle(label: string) {
  const lastCharacter = label.trim().at(-1);
  if (!lastCharacter) {
    return label;
  }

  const charCode = lastCharacter.charCodeAt(0);
  if (charCode < 0xac00 || charCode > 0xd7a3) {
    return `${label}을`;
  }

  return `${label}${(charCode - 0xac00) % 28 === 0 ? '를' : '을'}`;
}

function readResourceLabel(resource: string) {
  const normalized = resource.trim().toLowerCase();
  const directLabel = resourceLabelMap[normalized];
  if (directLabel) {
    return directLabel;
  }

  const compact = normalized.replace(/\s+/g, '');
  return resourceLabelMap[compact] ?? null;
}

function readFieldLabel(field: string) {
  const normalized = field.trim().replace(/\.\d+\./g, '.');
  return (
    fieldLabelMap[normalized] ??
    fieldLabelMap[normalized.split('.').at(-1) ?? ''] ??
    '입력값'
  );
}

const exactUserMessageMap: Record<string, string> = {
  'Invalid access token': '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  'Invalid refresh token': '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  'Expired token': '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  'Missing bearer token': '로그인이 필요합니다. 다시 로그인해 주세요.',
  'Missing refresh token': '로그인이 필요합니다. 다시 로그인해 주세요.',
  'Invalid session': '로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.',
  'User not active':
    '사용할 수 없는 계정입니다. 관리자에게 계정 상태를 확인해 주세요.',
  'Origin not allowed':
    '허용되지 않은 접속 환경입니다. 운영 도메인 또는 브라우저 설정을 확인해 주세요.',
  'Required account subjects are missing in this ledger.':
    '전표 생성에 필요한 계정과목 기준이 부족합니다. 기준 데이터의 공식 참조값을 확인해 주세요.',
  'A manual journal entry requires at least two lines.':
    '수동 전표는 차변과 대변을 포함해 최소 2개 라인이 필요합니다.',
  'Journal line amounts must be safe integers.':
    '전표 라인 금액은 원 단위의 정수로 입력해 주세요.',
  'Journal line amounts cannot be negative.':
    '전표 라인 금액은 0원 이상으로 입력해 주세요.',
  'Each journal line must carry either a debit or a credit amount.':
    '전표 라인마다 차변 또는 대변 중 하나의 금액만 입력해 주세요.',
  'Journal entry amount must be greater than zero.':
    '전표 금액은 0원보다 커야 합니다.',
  'Journal entry debit and credit totals must match.':
    '전표의 차변 합계와 대변 합계가 일치해야 합니다.',
  'Correction reason is required.': '정정 사유를 입력해 주세요.',
  'The journal adjustment is invalid.':
    '전표 조정 내용을 확인해 주세요. 차변·대변 금액과 라인 구성을 다시 점검해 주세요.',
  'One or more journal lines reference an unknown active account subject.':
    '전표 라인에 사용할 수 없는 계정과목이 포함되어 있습니다. 계정과목을 다시 선택해 주세요.',
  'One or more journal lines reference an unknown funding account.':
    '전표 라인에 사용할 수 없는 자금수단이 포함되어 있습니다. 자금수단을 다시 선택해 주세요.',
  'Journal entry changed during reversal. Please retry.':
    '반전 전표 생성 중 원본 전표 상태가 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.',
  'Journal entry changed during correction. Please retry.':
    '정정 전표 생성 중 원본 전표 상태가 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.',
  'Collected transaction changed during reversal. Please retry.':
    '반전 전표 생성 중 연결된 수집 거래 상태가 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.',
  'Collected transaction changed during correction. Please retry.':
    '정정 전표 생성 중 연결된 수집 거래 상태가 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.',
  'This posting policy requires a second account selection.':
    '전표 확정에 필요한 상대 계정을 선택해 주세요.',
  'This posting policy is not supported for collected transaction confirmation.':
    '현재 거래 유형은 전표 확정을 지원하지 않습니다. 거래 유형과 전표 정책을 확인해 주세요.',
  'Collected transaction is not linked to an accounting period.':
    '수집 거래에 연결된 운영 기간을 확인할 수 없습니다. 거래일과 운영 기간 설정을 확인해 주세요.',
  'Collected transaction changed during confirmation. Please retry.':
    '전표 확정 중 수집 거래 상태가 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.',
  'Original journal entry changed during reversal confirmation. Please retry.':
    '반전 확정 중 원본 전표 상태가 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.',
  'Original collected transaction changed during reversal confirmation. Please retry.':
    '반전 확정 중 원본 수집 거래 상태가 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.',
  'Collected transaction in a locked period cannot be confirmed.':
    '잠긴 운영 기간의 수집 거래는 확정할 수 없습니다. 운영 기간 상태를 확인해 주세요.',
  'Collected transaction in current status cannot be confirmed.':
    '현재 상태의 수집 거래는 전표로 확정할 수 없습니다. 거래 상태를 확인해 주세요.',
  'Only unposted collected transactions can be updated.':
    '전표로 확정되지 않은 수집·검토·전표 준비 상태의 거래만 수정할 수 있습니다.',
  'Only unposted collected transactions can be deleted.':
    '전표로 확정되지 않은 수집·검토·전표 준비 상태의 거래만 삭제할 수 있습니다.',
  'Collected transaction is already posted.':
    '이미 전표로 확정된 수집 거래입니다. 전표 조회에서 확인해 주세요.',
  'Collected transaction could not be updated in the current state.':
    '현재 상태에서는 이 수집 거래를 수정할 수 없습니다. 전표 반영 상태를 확인해 주세요.',
  'entryDate must follow the YYYY-MM-DD format.':
    '전표일은 YYYY-MM-DD 형식으로 입력해 주세요.',
  'Only posted collected transactions can be corrected.':
    '전표로 확정된 수집 거래만 정정할 수 있습니다.',
  'Posted collected transactions must be adjusted through journal entries.':
    '이미 전표로 확정된 수집 거래는 전표 정정 또는 반전으로 조정해 주세요.',
  'Only posted journal entries can be reversed.':
    '확정된 전표만 반전 전표를 만들 수 있습니다.',
  'Only posted journal entries can be corrected.':
    '확정된 전표만 정정 전표를 만들 수 있습니다.',
  'Created import batch could not be reloaded.':
    '업로드 배치를 생성했지만 결과를 다시 불러오지 못했습니다. 목록을 새로고침해 주세요.',
  'JSON body와 FormData는 동시에 보낼 수 없습니다.':
    '요청 형식이 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.'
};

const resourceLabelMap: Record<string, string> = {
  'workspace settings': '사업장 설정',
  workspace: '사업장',
  tenant: '사업장',
  'workspace tenant': '사업장',
  ledger: '장부',
  'workspace ledger': '장부',
  user: '사용자',
  'workspace member': '회원',
  'tenant membership': '회원',
  'tenant membership invitation': '초대',
  'auth session': '로그인 세션',
  'email verification token': '이메일 인증 링크',
  'funding account': '자금수단',
  category: '카테고리',
  'collected transaction': '수집 거래',
  'recurring rule': '반복 규칙',
  'plan item': '계획 항목',
  'accounting period': '운영 기간',
  period: '운영 기간',
  'journal entry': '전표',
  'original journal entry': '원본 전표',
  vehicle: '차량',
  'vehicle fuel log': '차량 연료 기록',
  'vehicle maintenance log': '차량 정비 이력',
  'import batch': '업로드 배치',
  'import batch collection job': '업로드 일괄 등록 작업',
  'import batch collection job row': '업로드 일괄 등록 행',
  'imported row': '업로드 행',
  'insurance policy': '보험 계약',
  'liability agreement': '부채 약정',
  'liability repayment schedule': '상환 예정',
  'liability account subject': '부채 계정과목',
  'interest expense category': '이자 비용 카테고리',
  'fee expense category': '수수료 비용 카테고리',
  'carry forward': '차기 이월',
  'audit event': '감사 로그',
  'workspace navigation menu item': '메뉴 항목',
  'account subject': '계정과목',
  'original collected transaction': '원본 수집 거래',
  workspacesettings: '사업장 설정',
  workspacetenant: '사업장',
  workspaceledger: '장부',
  workspacemember: '회원',
  tenantmembership: '회원',
  tenantmembershipinvitation: '초대',
  authsession: '로그인 세션',
  emailverificationtoken: '이메일 인증 링크',
  fundingaccount: '자금수단',
  collectedtransaction: '수집 거래',
  recurringrule: '반복 규칙',
  planitem: '계획 항목',
  accountingperiod: '운영 기간',
  journalentry: '전표',
  originaljournalentry: '원본 전표',
  vehiclefuellog: '차량 연료 기록',
  vehiclemaintenancelog: '차량 정비 이력',
  importbatch: '업로드 배치',
  importbatchcollectionjob: '업로드 일괄 등록 작업',
  importbatchcollectionjobrow: '업로드 일괄 등록 행',
  importedrow: '업로드 행',
  insurancepolicy: '보험 계약',
  liabilityagreement: '부채 약정',
  liabilityrepaymentschedule: '상환 예정',
  liabilityaccountsubject: '부채 계정과목',
  interestexpensecategory: '이자 비용 카테고리',
  feeexpensecategory: '수수료 비용 카테고리',
  carryforward: '차기 이월',
  auditevent: '감사 로그',
  workspacenavigationmenuitem: '메뉴 항목',
  accountsubject: '계정과목',
  originalcollectedtransaction: '원본 수집 거래'
};

const fieldLabelMap: Record<string, string> = {
  email: '이메일',
  password: '비밀번호',
  currentPassword: '현재 비밀번호',
  newPassword: '새 비밀번호',
  name: '이름',
  title: '제목',
  body: '본문',
  month: '운영 월',
  periodId: '운영 기간',
  fundingAccountId: '자금수단',
  categoryId: '카테고리',
  transactionType: '거래 유형',
  amountWon: '금액',
  transactionDate: '거래일',
  entryDate: '전표일',
  sourceKind: '원본 종류',
  rawContent: '업로드 내용',
  fileName: '파일명',
  role: '역할',
  status: '상태',
  allowedRoles: '허용 역할'
};
