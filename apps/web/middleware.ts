import { NextResponse, type NextRequest } from 'next/server';

const NONCE_HEADER = 'x-nonce';
const CSP_HEADER = 'Content-Security-Policy';

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function readOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function uniqueSources(sources: string[]) {
  return Array.from(new Set(sources));
}

function buildContentSecurityPolicy(nonce: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const apiOrigin = readOrigin(process.env.NEXT_PUBLIC_API_BASE_URL);
  const canUpgradeInsecureRequests =
    isProduction && !apiOrigin?.startsWith('http://');
  const connectSources = uniqueSources([
    "'self'",
    ...(apiOrigin ? [apiOrigin] : []),
    ...(!isProduction
      ? [
          'http://localhost:4000',
          'http://127.0.0.1:4000',
          'ws://localhost:3000',
          'ws://127.0.0.1:3000'
        ]
      : [])
  ]);

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      !isProduction ? " 'unsafe-eval'" : ''
    }`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ];

  if (canUpgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

export function middleware(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.headers.set(CSP_HEADER, contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
};
