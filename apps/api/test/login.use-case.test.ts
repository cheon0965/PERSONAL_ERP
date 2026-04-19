import assert from 'node:assert/strict';
import test from 'node:test';
import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from '../src/modules/auth/application/use-cases/login.use-case';

test('LoginUseCase.execute returns the issued session for valid credentials', async () => {
  const passwordHash = await argon2.hash('Demo1234!');

  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash,
        status: 'ACTIVE',
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

  const useCase = new LoginUseCase(
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
      clearLoginAttempts: () => undefined
    } as never,
    {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    } as never
  );

  const result = await useCase.execute(
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

test('LoginUseCase.execute rejects invalid credentials', async () => {
  const passwordHash = await argon2.hash('Demo1234!');

  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date('2026-03-01T00:00:00.000Z')
      })
    }
  };

  const useCase = new LoginUseCase(
    prisma as never,
    {
      issueSession: async () => {
        throw new Error('should not issue session for invalid login');
      }
    } as never,
    {
      assertLoginAttemptAllowed: () => undefined,
      recordFailedLoginAttempt: () => undefined,
      clearLoginAttempts: () => undefined
    } as never,
    {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    } as never
  );

  await assert.rejects(
    () =>
      useCase.execute(
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
