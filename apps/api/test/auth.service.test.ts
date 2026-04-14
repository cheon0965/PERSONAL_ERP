import assert from 'node:assert/strict';
import test from 'node:test';
import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';

test('AuthService.login returns the issued session for valid credentials', async () => {
  const passwordHash = await argon2.hash('Demo1234!');

  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash,
        emailVerifiedAt: new Date('2026-03-01T00:00:00.000Z')
      })
    }
  };

  const issuedIdentities: Array<{
    id: string;
    email: string;
    name: string;
  }> = [];
  const issuedSessionResult = {
    sessionId: 'session-1',
    accessToken: 'access-token:session-1',
    refreshToken: 'refresh-token:session-1',
    user: {
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo User',
      currentWorkspace: {
        tenant: {
          id: 'tenant-1',
          slug: 'demo-tenant',
          name: 'Demo Workspace',
          status: 'ACTIVE'
        },
        membership: {
          id: 'membership-1',
          role: 'OWNER',
          status: 'ACTIVE'
        },
        ledger: {
          id: 'ledger-1',
          name: '사업 장부',
          baseCurrency: 'KRW',
          timezone: 'Asia/Seoul',
          status: 'ACTIVE'
        }
      }
    }
  };

  const service = new AuthService(
    prisma as never,
    {
      issueSession: async (identity: {
        id: string;
        email: string;
        name: string;
      }) => {
        issuedIdentities.push(identity);
        return issuedSessionResult;
      }
    } as never,
    {
      assertLoginAttemptAllowed: () => undefined,
      recordFailedLoginAttempt: () => undefined,
      clearLoginAttempts: () => undefined,
      assertRefreshAttemptAllowed: () => undefined,
      recordFailedRefreshAttempt: () => undefined,
      clearRefreshAttempts: () => undefined
    } as never,
    {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    } as never,
    {
      send: async () => undefined
    } as never,
    {
      now: () => new Date('2026-04-13T00:00:00.000Z')
    } as never,
    {
      ensureForUser: async () => ({
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        membershipId: 'membership-1'
      })
    } as never,
    {
      record: async () => undefined
    } as never
  );

  const result = await service.login(
    {
      email: 'demo@example.com',
      password: 'Demo1234!'
    },
    {
      clientIp: '127.0.0.1',
      requestId: 'request-auth-service-login'
    }
  );

  assert.equal(result, issuedSessionResult);
  assert.deepEqual(issuedIdentities, [
    {
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo User'
    }
  ]);
});

test('AuthService.login rejects invalid credentials', async () => {
  const passwordHash = await argon2.hash('Demo1234!');

  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash,
        emailVerifiedAt: new Date('2026-03-01T00:00:00.000Z')
      })
    }
  };

  const service = new AuthService(
    prisma as never,
    {
      issueSession: async () => {
        throw new Error('should not issue session for invalid login');
      }
    } as never,
    {
      assertLoginAttemptAllowed: () => undefined,
      recordFailedLoginAttempt: () => undefined,
      clearLoginAttempts: () => undefined,
      assertRefreshAttemptAllowed: () => undefined,
      recordFailedRefreshAttempt: () => undefined,
      clearRefreshAttempts: () => undefined
    } as never,
    {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    } as never,
    {
      send: async () => undefined
    } as never,
    {
      now: () => new Date('2026-04-13T00:00:00.000Z')
    } as never,
    {
      ensureForUser: async () => ({
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        membershipId: 'membership-1'
      })
    } as never,
    {
      record: async () => undefined
    } as never
  );

  await assert.rejects(
    () =>
      service.login(
        {
          email: 'demo@example.com',
          password: 'WrongPassword!'
        },
        {
          clientIp: '127.0.0.1',
          requestId: 'request-auth-service-invalid-login'
        }
      ),
    (error: unknown) =>
      error instanceof UnauthorizedException &&
      error.message === '이메일 또는 비밀번호가 올바르지 않습니다.'
  );
});
