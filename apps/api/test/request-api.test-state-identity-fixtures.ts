import { LedgerTransactionFlowKind } from '@prisma/client';
import type { RequestTestState } from './request-api.test-types';

export function createRequestIdentityStateFixtures(input: {
  passwordHash: string;
  activeSessionExpiresAt: Date;
}): Pick<
  RequestTestState,
  | 'users'
  | 'tenants'
  | 'memberships'
  | 'ledgers'
  | 'ledgerTransactionTypes'
  | 'authSessions'
> {
  const { passwordHash, activeSessionExpiresAt } = input;

  return {
    users: [
      {
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash,
        status: 'ACTIVE',
        lockedReason: null,
        lockedAt: null,
        emailVerifiedAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        settings: {
          minimumReserveWon: 500_000,
          monthlySinkingFundWon: 210_000,
          timezone: 'Asia/Seoul'
        }
      },
      {
        id: 'user-2',
        email: 'other@example.com',
        name: 'Other User',
        passwordHash,
        status: 'ACTIVE',
        lockedReason: null,
        lockedAt: null,
        emailVerifiedAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        settings: {
          minimumReserveWon: 900_000,
          monthlySinkingFundWon: 310_000,
          timezone: 'Asia/Seoul'
        }
      }
    ],
    tenants: [
      {
        id: 'tenant-1',
        slug: 'demo-tenant',
        name: 'Demo Workspace',
        status: 'ACTIVE',
        defaultLedgerId: 'ledger-1'
      },
      {
        id: 'tenant-2',
        slug: 'other-tenant',
        name: 'Other Workspace',
        status: 'ACTIVE',
        defaultLedgerId: 'ledger-2'
      }
    ],
    memberships: [
      {
        id: 'membership-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date('2026-03-01T00:00:00.000Z'),
        invitedByMembershipId: null,
        lastAccessAt: null
      },
      {
        id: 'membership-2',
        tenantId: 'tenant-2',
        userId: 'user-2',
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date('2026-03-01T00:00:00.000Z'),
        invitedByMembershipId: null,
        lastAccessAt: null
      }
    ],
    ledgers: [
      {
        id: 'ledger-1',
        tenantId: 'tenant-1',
        name: '사업 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'ledger-2',
        tenantId: 'tenant-2',
        name: 'Other Ledger',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      }
    ],
    ledgerTransactionTypes: [
      {
        id: 'ltt-1-income',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: 'INCOME_BASIC',
        name: '기본 수입',
        flowKind: LedgerTransactionFlowKind.INCOME,
        postingPolicyKey: 'INCOME_BASIC',
        isActive: true
      },
      {
        id: 'ltt-1-expense',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: 'EXPENSE_BASIC',
        name: '기본 지출',
        flowKind: LedgerTransactionFlowKind.EXPENSE,
        postingPolicyKey: 'EXPENSE_BASIC',
        isActive: true
      },
      {
        id: 'ltt-1-transfer',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: 'TRANSFER_BASIC',
        name: '기본 이체',
        flowKind: LedgerTransactionFlowKind.TRANSFER,
        postingPolicyKey: 'TRANSFER_BASIC',
        isActive: true
      },
      {
        id: 'ltt-1-adjustment',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: 'MANUAL_ADJUSTMENT',
        name: '수동 조정',
        flowKind: LedgerTransactionFlowKind.ADJUSTMENT,
        postingPolicyKey: 'MANUAL_ADJUSTMENT',
        isActive: true
      },
      {
        id: 'ltt-2-expense',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: 'EXPENSE_BASIC',
        name: '기본 지출',
        flowKind: LedgerTransactionFlowKind.EXPENSE,
        postingPolicyKey: 'EXPENSE_BASIC',
        isActive: true
      }
    ],
    authSessions: [
      {
        id: 'session-user-1',
        userId: 'user-1',
        refreshTokenHash: 'existing-session-hash',
        expiresAt: activeSessionExpiresAt,
        revokedAt: null,
        supportTenantId: null,
        supportLedgerId: null,
        supportStartedAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'session-user-2',
        userId: 'user-2',
        refreshTokenHash: 'existing-session-hash',
        expiresAt: activeSessionExpiresAt,
        revokedAt: null,
        supportTenantId: null,
        supportLedgerId: null,
        supportStartedAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z')
      }
    ]
  };
}
