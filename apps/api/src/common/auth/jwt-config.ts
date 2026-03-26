import { getApiEnv } from '../../config/api-env';

export type JwtExpiresIn = number | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

export function resolveJwtExpiresIn(value: string | undefined, fallback: JwtExpiresIn): JwtExpiresIn {
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
