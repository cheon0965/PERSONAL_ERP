type EnvSource = Record<string, unknown>;

export type ApiEnv = {
  PORT: number;
  APP_ORIGIN: string;
  CORS_ALLOWED_ORIGINS: string[];
  SWAGGER_ENABLED: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL: string;
  EMAIL_VERIFICATION_TTL: string;
  DATABASE_URL: string;
  DEMO_EMAIL: string;
  INITIAL_ADMIN_EMAIL: string | null;
  INITIAL_ADMIN_NAME: string | null;
  INITIAL_ADMIN_PASSWORD: string | null;
  MAIL_PROVIDER: 'console' | 'gmail-api';
  MAIL_FROM_EMAIL: string;
  MAIL_FROM_NAME: string;
  GMAIL_CLIENT_ID: string | null;
  GMAIL_CLIENT_SECRET: string | null;
  GMAIL_REFRESH_TOKEN: string | null;
  GMAIL_SENDER_EMAIL: string | null;
};

const JWT_DURATION_PATTERN = /^\d+(ms|s|m|h|d|w|y)?$/;
const BASE64URL_SECRET_PATTERN = /^[A-Za-z0-9_-]+$/;
const BASE64_SECRET_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const JWT_SECRET_PLACEHOLDER_PATTERN =
  /^(replace[-_]?with|change[-_]?me|changeme|example|sample|test)/i;
const MIN_JWT_SECRET_BYTES = 32;

let cachedApiEnv: ApiEnv | undefined;

function readString(
  source: EnvSource,
  key: string,
  options?: {
    fallback?: string;
    minLength?: number;
  }
): string {
  const rawValue = source[key];
  const fallback = options?.fallback;
  const minLength = options?.minLength ?? 1;
  const value =
    typeof rawValue === 'string' ? rawValue.trim() : fallback?.trim();

  if (!value) {
    throw new Error(`[api env] ${key} is required.`);
  }

  if (value.length < minLength) {
    throw new Error(
      `[api env] ${key} must be at least ${minLength} characters long.`
    );
  }

  return value;
}

function readOptionalString(
  source: EnvSource,
  key: string,
  options?: {
    minLength?: number;
    maxLength?: number;
  }
): string | null {
  const rawValue = source[key];
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value) {
    return null;
  }

  const minLength = options?.minLength;
  if (minLength !== undefined && value.length < minLength) {
    throw new Error(
      `[api env] ${key} must be at least ${minLength} characters long.`
    );
  }

  const maxLength = options?.maxLength;
  if (maxLength !== undefined && value.length > maxLength) {
    throw new Error(
      `[api env] ${key} must be at most ${maxLength} characters long.`
    );
  }

  return value;
}

function readPort(source: EnvSource): number {
  const value = readString(source, 'PORT');
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('[api env] PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function readUrl(source: EnvSource, key: string): string {
  const value = readString(source, key);

  try {
    const url = new URL(value);
    return key === 'APP_ORIGIN' ? url.origin : url.toString();
  } catch {
    throw new Error(`[api env] ${key} must be a valid URL.`);
  }
}

function readBoolean(
  source: EnvSource,
  key: string,
  fallback: boolean
): boolean {
  const rawValue = source[key];

  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return fallback;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error(`[api env] ${key} must be either true or false.`);
}

function readAllowedOrigins(
  source: EnvSource,
  fallbackOrigin: string
): string[] {
  const rawValue = source.CORS_ALLOWED_ORIGINS;
  const rawOrigins =
    typeof rawValue === 'string' && rawValue.trim().length > 0
      ? rawValue.split(',')
      : [fallbackOrigin];

  const normalizedOrigins = rawOrigins.map((candidate) => {
    const trimmed = candidate.trim();

    if (!trimmed) {
      throw new Error(
        '[api env] CORS_ALLOWED_ORIGINS must not contain empty entries.'
      );
    }

    try {
      return new URL(trimmed).origin;
    } catch {
      throw new Error(
        `[api env] CORS_ALLOWED_ORIGINS contains an invalid URL: ${trimmed}`
      );
    }
  });

  return [...new Set(normalizedOrigins)];
}

function readJwtDuration(source: EnvSource, key: string): string {
  const value = readString(source, key);

  if (!JWT_DURATION_PATTERN.test(value)) {
    throw new Error(
      `[api env] ${key} must be a positive integer or a duration like 15m, 7d, or 3600.`
    );
  }

  return value;
}

function readJwtSecret(source: EnvSource, key: string): string {
  const value = readString(source, key, {
    minLength: 43
  });

  if (JWT_SECRET_PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(
      `[api env] ${key} must be generated random bytes, not an example placeholder. Generate one with randomBytes(32).toString('base64url').`
    );
  }

  const decodedLength = readBase64SecretByteLength(value);

  if (decodedLength < MIN_JWT_SECRET_BYTES) {
    throw new Error(
      `[api env] ${key} must decode to at least ${MIN_JWT_SECRET_BYTES} random bytes. Generate one with randomBytes(32).toString('base64url').`
    );
  }

  if (new Set(value).size < 8) {
    throw new Error(
      `[api env] ${key} must not be a repeated or low-variation secret.`
    );
  }

  return value;
}

function readBase64SecretByteLength(value: string): number {
  if (BASE64URL_SECRET_PATTERN.test(value)) {
    return Buffer.from(
      padBase64(value.replace(/-/g, '+').replace(/_/g, '/')),
      'base64'
    ).length;
  }

  if (BASE64_SECRET_PATTERN.test(value)) {
    return Buffer.from(padBase64(value), 'base64').length;
  }

  throw new Error(
    '[api env] JWT secrets must be base64url or base64 encoded random bytes.'
  );
}

function padBase64(value: string): string {
  return value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
}

function readJwtDurationWithFallback(
  source: EnvSource,
  key: string,
  fallback: string
): string {
  const rawValue = source[key];
  const value =
    typeof rawValue === 'string' && rawValue.trim()
      ? rawValue.trim()
      : fallback;

  if (!JWT_DURATION_PATTERN.test(value)) {
    throw new Error(
      `[api env] ${key} must be a positive integer or a duration like 15m, 7d, or 3600.`
    );
  }

  return value;
}

function readMailProvider(source: EnvSource): ApiEnv['MAIL_PROVIDER'] {
  const rawValue = source.MAIL_PROVIDER;
  const value =
    typeof rawValue === 'string' && rawValue.trim()
      ? rawValue.trim().toLowerCase()
      : 'console';

  if (value === 'console' || value === 'gmail-api') {
    return value;
  }

  throw new Error('[api env] MAIL_PROVIDER must be console or gmail-api.');
}

function readRequiredGmailString(
  source: EnvSource,
  key: string,
  mailProvider: ApiEnv['MAIL_PROVIDER']
): string | null {
  const value = readOptionalString(source, key);

  if (mailProvider === 'gmail-api' && !value) {
    throw new Error(
      `[api env] ${key} is required when MAIL_PROVIDER=gmail-api.`
    );
  }

  return value;
}

export function parseApiEnv(source: EnvSource): ApiEnv {
  const appOrigin = readUrl(source, 'APP_ORIGIN');
  const mailProvider = readMailProvider(source);
  const jwtAccessSecret = readJwtSecret(source, 'JWT_ACCESS_SECRET');
  const jwtRefreshSecret = readJwtSecret(source, 'JWT_REFRESH_SECRET');

  if (jwtAccessSecret === jwtRefreshSecret) {
    throw new Error(
      '[api env] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.'
    );
  }

  return {
    PORT: readPort(source),
    APP_ORIGIN: appOrigin,
    CORS_ALLOWED_ORIGINS: readAllowedOrigins(source, appOrigin),
    SWAGGER_ENABLED: readBoolean(source, 'SWAGGER_ENABLED', false),
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    ACCESS_TOKEN_TTL: readJwtDuration(source, 'ACCESS_TOKEN_TTL'),
    REFRESH_TOKEN_TTL: readJwtDuration(source, 'REFRESH_TOKEN_TTL'),
    EMAIL_VERIFICATION_TTL: readJwtDurationWithFallback(
      source,
      'EMAIL_VERIFICATION_TTL',
      '30m'
    ),
    DATABASE_URL: readUrl(source, 'DATABASE_URL'),
    DEMO_EMAIL: readString(source, 'DEMO_EMAIL', {
      fallback: 'demo@example.com'
    }),
    INITIAL_ADMIN_EMAIL: readOptionalString(source, 'INITIAL_ADMIN_EMAIL', {
      maxLength: 191
    }),
    INITIAL_ADMIN_NAME: readOptionalString(source, 'INITIAL_ADMIN_NAME', {
      maxLength: 80
    }),
    INITIAL_ADMIN_PASSWORD: readOptionalString(
      source,
      'INITIAL_ADMIN_PASSWORD',
      {
        minLength: 8,
        maxLength: 128
      }
    ),
    MAIL_PROVIDER: mailProvider,
    MAIL_FROM_EMAIL: readString(source, 'MAIL_FROM_EMAIL', {
      fallback: 'no-reply@example.com'
    }),
    MAIL_FROM_NAME: readString(source, 'MAIL_FROM_NAME', {
      fallback: 'PERSONAL_ERP'
    }),
    GMAIL_CLIENT_ID: readRequiredGmailString(
      source,
      'GMAIL_CLIENT_ID',
      mailProvider
    ),
    GMAIL_CLIENT_SECRET: readRequiredGmailString(
      source,
      'GMAIL_CLIENT_SECRET',
      mailProvider
    ),
    GMAIL_REFRESH_TOKEN: readRequiredGmailString(
      source,
      'GMAIL_REFRESH_TOKEN',
      mailProvider
    ),
    GMAIL_SENDER_EMAIL: readRequiredGmailString(
      source,
      'GMAIL_SENDER_EMAIL',
      mailProvider
    )
  };
}

export function validateApiEnv(
  config: Record<string, unknown>
): Record<string, unknown> {
  const env = parseApiEnv(config);

  return {
    ...config,
    ...env,
    PORT: String(env.PORT),
    CORS_ALLOWED_ORIGINS: env.CORS_ALLOWED_ORIGINS.join(','),
    SWAGGER_ENABLED: String(env.SWAGGER_ENABLED),
    INITIAL_ADMIN_EMAIL: env.INITIAL_ADMIN_EMAIL ?? '',
    INITIAL_ADMIN_NAME: env.INITIAL_ADMIN_NAME ?? '',
    INITIAL_ADMIN_PASSWORD: env.INITIAL_ADMIN_PASSWORD ?? '',
    GMAIL_CLIENT_ID: env.GMAIL_CLIENT_ID ?? '',
    GMAIL_CLIENT_SECRET: env.GMAIL_CLIENT_SECRET ?? '',
    GMAIL_REFRESH_TOKEN: env.GMAIL_REFRESH_TOKEN ?? '',
    GMAIL_SENDER_EMAIL: env.GMAIL_SENDER_EMAIL ?? ''
  };
}

export function getApiEnv(): ApiEnv {
  if (!cachedApiEnv) {
    cachedApiEnv = parseApiEnv(process.env);
  }

  return cachedApiEnv;
}

export function resetApiEnvCache(): void {
  cachedApiEnv = undefined;
}
