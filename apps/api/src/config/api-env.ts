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
  DATABASE_URL: string;
  DEMO_EMAIL: string;
};

const JWT_DURATION_PATTERN = /^\d+(ms|s|m|h|d|w|y)?$/;

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

export function parseApiEnv(source: EnvSource): ApiEnv {
  const appOrigin = readUrl(source, 'APP_ORIGIN');

  return {
    PORT: readPort(source),
    APP_ORIGIN: appOrigin,
    CORS_ALLOWED_ORIGINS: readAllowedOrigins(source, appOrigin),
    SWAGGER_ENABLED: readBoolean(source, 'SWAGGER_ENABLED', true),
    JWT_ACCESS_SECRET: readString(source, 'JWT_ACCESS_SECRET', {
      minLength: 16
    }),
    JWT_REFRESH_SECRET: readString(source, 'JWT_REFRESH_SECRET', {
      minLength: 16
    }),
    ACCESS_TOKEN_TTL: readJwtDuration(source, 'ACCESS_TOKEN_TTL'),
    REFRESH_TOKEN_TTL: readJwtDuration(source, 'REFRESH_TOKEN_TTL'),
    DATABASE_URL: readUrl(source, 'DATABASE_URL'),
    DEMO_EMAIL: readString(source, 'DEMO_EMAIL', {
      fallback: 'demo@example.com'
    })
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
    SWAGGER_ENABLED: String(env.SWAGGER_ENABLED)
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
