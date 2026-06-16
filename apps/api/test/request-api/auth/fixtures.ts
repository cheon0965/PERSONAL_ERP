import assert from 'node:assert/strict';
import type { RequestTestState } from '../../support/request-api/types';

export const REFRESH_COOKIE_NAME = '__Host-refreshToken';

export const LEGACY_REFRESH_COOKIE_NAME = 'refreshToken';

export function buildRegisterRequest(input: {
  email: string;
  password: string;
  name: string;
}) {
  return {
    ...input,
    termsAccepted: true,
    privacyConsentAccepted: true
  };
}

export function addWorkspaceFixture(
  state: RequestTestState,
  input: {
    tenantId?: string;
    tenantSlug?: string;
    tenantName?: string;
    ledgerId?: string;
    ledgerName?: string;
    membershipId?: string;
    userId?: string;
    role?: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
    joinedAt?: Date;
  } = {}
) {
  const tenantId = input.tenantId ?? 'tenant-delete';
  const ledgerId = input.ledgerId ?? 'ledger-delete';
  const membershipId = input.membershipId ?? 'membership-delete';

  state.tenants.push({
    id: tenantId,
    slug: input.tenantSlug ?? tenantId,
    name: input.tenantName ?? 'Delete Workspace',
    status: 'ACTIVE',
    defaultLedgerId: ledgerId
  });
  state.ledgers.push({
    id: ledgerId,
    tenantId,
    name: input.ledgerName ?? 'Delete Ledger',
    baseCurrency: 'KRW',
    timezone: 'Asia/Seoul',
    status: 'ACTIVE',
    createdAt: input.joinedAt ?? new Date('2026-03-15T00:00:00.000Z')
  });
  state.memberships.push({
    id: membershipId,
    tenantId,
    userId: input.userId ?? 'user-1',
    role: input.role ?? 'OWNER',
    status: 'ACTIVE',
    joinedAt: input.joinedAt ?? new Date('2026-03-15T00:00:00.000Z'),
    invitedByMembershipId: null,
    lastAccessAt: null
  });

  return { tenantId, ledgerId, membershipId };
}

export function readEmailVerificationToken(text: string | undefined): string {
  assert.ok(text);
  const match = text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(match?.[1]);
  return match[1];
}

export function buildInvalidVerificationToken(suffix: string): string {
  return `invalid-verification-token-${suffix}`.padEnd(40, 'x');
}
