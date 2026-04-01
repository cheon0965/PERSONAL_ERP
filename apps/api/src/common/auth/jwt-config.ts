import { getApiEnv } from '../../config/api-env';

export type JwtExpiresIn =
  | number
  | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

const JWT_DURATION_TO_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000
} as const;

export function resolveJwtExpiresIn(
  value: string | undefined,
  fallback: JwtExpiresIn
): JwtExpiresIn {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  const asNumber = Number(normalized);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return asNumber;
  }

  return normalized as JwtExpiresIn;
}

export function getAccessTokenSecret(): string {
  return getApiEnv().JWT_ACCESS_SECRET;
}

export function getRefreshTokenSecret(): string {
  return getApiEnv().JWT_REFRESH_SECRET;
}

export function getAccessTokenTtl(): JwtExpiresIn {
  const env = getApiEnv();
  return resolveJwtExpiresIn(env.ACCESS_TOKEN_TTL, '15m');
}

export function getRefreshTokenTtl(): JwtExpiresIn {
  const env = getApiEnv();
  return resolveJwtExpiresIn(env.REFRESH_TOKEN_TTL, '7d');
}

export function parseJwtDurationToMs(
  value: string | undefined,
  fallbackMs: number
): number {
  const normalized = value?.trim();
  if (!normalized) {
    return fallbackMs;
  }

  const match = normalized.match(/^(\d+)(ms|s|m|h|d|w|y)?$/);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's') as keyof typeof JWT_DURATION_TO_MS;
  return amount * JWT_DURATION_TO_MS[unit];
}

export function getRefreshTokenMaxAgeMs(): number {
  const env = getApiEnv();
  return parseJwtDurationToMs(env.REFRESH_TOKEN_TTL, 7 * 24 * 60 * 60 * 1000);
}
