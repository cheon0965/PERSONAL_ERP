import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiEnv } from '../../../config/api-env';

const API_DOCS_PATH_PREFIX = '/api/docs';
const API_CONTENT_SECURITY_POLICY =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const API_PERMISSIONS_POLICY = 'camera=(), geolocation=(), microphone=()';
const HTTPS_STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

export function createCorsOriginDelegate(allowedOrigins: string[]) {
  return (origin: string | undefined, callback: CorsOriginCallback): void => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  };
}

export function applyBrowserBoundaryHeaders(
  request: Request,
  response: Response,
  env: ApiEnv
): void {
  const path = normalizeRequestPath(request.originalUrl ?? request.url);

  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', API_PERMISSIONS_POLICY);
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  if (!isSwaggerPath(path)) {
    response.setHeader('Content-Security-Policy', API_CONTENT_SECURITY_POLICY);
  }

  if (isHttpsOrigin(env.APP_ORIGIN)) {
    response.setHeader(
      'Strict-Transport-Security',
      HTTPS_STRICT_TRANSPORT_SECURITY
    );
  }

  if (
    shouldSendNoStoreHeaders(request, path) &&
    response.getHeader('Cache-Control') === undefined
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
  }
}

export function assertAllowedBrowserOrigin(
  request: Request,
  allowedOrigins: string[]
): void {
  const browserOrigin = resolveBrowserOrigin(request);
  if (!browserOrigin) {
    return;
  }

  if (!allowedOrigins.includes(browserOrigin)) {
    throw new ForbiddenException('Origin not allowed');
  }
}

function shouldSendNoStoreHeaders(request: Request, path: string): boolean {
  return (
    request.method.toUpperCase() !== 'OPTIONS' &&
    (path.startsWith('/api/auth/') ||
      typeof request.headers.authorization === 'string')
  );
}

function normalizeRequestPath(path: string): string {
  return path.split('?')[0] ?? path;
}

function isSwaggerPath(path: string): boolean {
  return normalizeRequestPath(path).startsWith(API_DOCS_PATH_PREFIX);
}

function isHttpsOrigin(origin: string): boolean {
  return new URL(origin).protocol === 'https:';
}

function resolveBrowserOrigin(
  request: Pick<Request, 'headers'>
): string | null {
  const origin = readOriginHeader(request.headers.origin);
  if (origin) {
    return origin;
  }

  return readRefererOrigin(request.headers.referer);
}

function readOriginHeader(
  rawHeader: string | string[] | undefined
): string | null {
  if (typeof rawHeader === 'string') {
    return normalizeOriginValue(rawHeader);
  }

  if (Array.isArray(rawHeader)) {
    for (const candidate of rawHeader) {
      const normalized = normalizeOriginValue(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function readRefererOrigin(
  rawHeader: string | string[] | undefined
): string | null {
  const referer =
    typeof rawHeader === 'string'
      ? rawHeader
      : Array.isArray(rawHeader)
        ? rawHeader[0]
        : undefined;

  if (!referer?.trim()) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function normalizeOriginValue(candidate: string | undefined): string | null {
  const trimmed = candidate?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase() === 'null') {
    return 'null';
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}
