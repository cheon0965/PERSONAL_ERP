import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export type RequestWithContext = Request & {
  requestId?: string;
};

export function normalizeRequestId(
  rawHeader: string | string[] | undefined
): string {
  if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
    return rawHeader.trim();
  }

  if (Array.isArray(rawHeader) && rawHeader.length > 0) {
    const first = rawHeader[0]?.trim();
    if (first) {
      return first;
    }
  }

  return randomUUID();
}

export function readRequestId(
  request: Pick<RequestWithContext, 'requestId'>
): string | undefined {
  const requestId = request.requestId?.trim();
  return requestId ? requestId : undefined;
}

export function readRequestPath(
  request: Pick<Request, 'originalUrl' | 'url'>
): string {
  return request.originalUrl ?? request.url;
}

export function readClientIp(request: Pick<Request, 'ip'>): string {
  return request.ip?.trim() || 'unknown-client';
}

export function ensureRequestContext(
  request: RequestWithContext,
  response: Pick<Response, 'setHeader'>
): string {
  const requestId =
    readRequestId(request) ??
    normalizeRequestId(request.headers[REQUEST_ID_HEADER]);
  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}
