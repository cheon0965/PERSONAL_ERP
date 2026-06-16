import { formatAuthLinkTtlLabel } from './auth-link-ttl.mapper';

export function buildVerificationUrl(input: {
  appOrigin: string;
  token: string;
}): string {
  const url = new URL('/verify-email', input.appOrigin);
  url.searchParams.set('token', input.token);
  return url.toString();
}

export function buildPasswordResetUrl(input: {
  appOrigin: string;
  token: string;
}): string {
  const url = new URL('/reset-password', input.appOrigin);
  url.searchParams.set('token', input.token);
  return url.toString();
}

export function formatPasswordResetTtlLabel(ttlMs: number): string {
  return formatAuthLinkTtlLabel(ttlMs);
}
