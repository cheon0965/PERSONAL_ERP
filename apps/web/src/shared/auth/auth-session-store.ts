export type UnauthorizedSessionReason =
  | 'missing_access_token'
  | 'unauthorized_response';

type UnauthorizedSessionHandler = (reason: UnauthorizedSessionReason) => void;

type RefreshSessionHandler = () => Promise<string | null>;

let accessTokenCache: string | null = null;
let unauthorizedSessionHandler: UnauthorizedSessionHandler | null = null;
let refreshSessionHandler: RefreshSessionHandler | null = null;
let inFlightRefresh: Promise<string | null> | null = null;

export function getStoredAccessToken(): string | null {
  return accessTokenCache;
}

export function setStoredAccessToken(token: string): void {
  accessTokenCache = token;
}

export function clearStoredAccessToken(): void {
  accessTokenCache = null;
}

export function setUnauthorizedSessionHandler(
  handler: UnauthorizedSessionHandler | null
): void {
  unauthorizedSessionHandler = handler;
}

export function setRefreshSessionHandler(
  handler: RefreshSessionHandler | null
): void {
  refreshSessionHandler = handler;
}

export async function refreshStoredAccessToken(): Promise<string | null> {
  if (!refreshSessionHandler) {
    return null;
  }

  if (!inFlightRefresh) {
    inFlightRefresh = refreshSessionHandler().finally(() => {
      inFlightRefresh = null;
    });
  }

  return inFlightRefresh;
}

export function handleUnauthorizedSession(
  reason: UnauthorizedSessionReason
): void {
  clearStoredAccessToken();
  unauthorizedSessionHandler?.(reason);
}

export const accessTokenStoragePolicy = '로그인 중에만 보관';
