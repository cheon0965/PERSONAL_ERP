import assert from 'node:assert/strict';
import test from 'node:test';
import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';

function setJwtEnv() {
  const previous = {
    PORT: process.env.PORT,
    APP_ORIGIN: process.env.APP_ORIGIN,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL,
    DATABASE_URL: process.env.DATABASE_URL,
    DEMO_EMAIL: process.env.DEMO_EMAIL
  };

  process.env.PORT = '4000';
  process.env.APP_ORIGIN = 'http://localhost:3000';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-2';
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.REFRESH_TOKEN_TTL = '7d';
  process.env.DATABASE_URL =
    'mysql://test:test@localhost:3306/personal_erp_test';
  process.env.DEMO_EMAIL = 'demo@example.com';

  return () => {
    process.env.PORT = previous.PORT;
    process.env.APP_ORIGIN = previous.APP_ORIGIN;
    process.env.JWT_ACCESS_SECRET = previous.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = previous.JWT_REFRESH_SECRET;
    process.env.ACCESS_TOKEN_TTL = previous.ACCESS_TOKEN_TTL;
    process.env.REFRESH_TOKEN_TTL = previous.REFRESH_TOKEN_TTL;
    process.env.DATABASE_URL = previous.DATABASE_URL;
    process.env.DEMO_EMAIL = previous.DEMO_EMAIL;
  };
}

test('AuthService.login returns tokens and user for valid credentials', async () => {
  const restoreEnv = setJwtEnv();
  const passwordHash = await argon2.hash('Demo1234!');
  const createdSessions: Array<Record<string, unknown>> = [];

  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash
      })
    },
    tenantMembership: {
      findMany: async () => [
        {
          id: 'membership-1',
          role: 'OWNER',
          status: 'ACTIVE',
          tenantId: 'tenant-1',
          joinedAt: new Date('2026-03-01T00:00:00.000Z')
        }
      ]
    },
    tenant: {
      findUnique: async () => ({
        id: 'tenant-1',
        slug: 'demo-tenant',
        name: 'Demo Workspace',
        status: 'ACTIVE',
        defaultLedgerId: 'ledger-1'
      })
    },
    ledger: {
      findUnique: async () => ({
        id: 'ledger-1',
        name: '개인 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE'
      }),
      findFirst: async () => null
    },
    authSession: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdSessions.push(args.data);
        return args.data;
      }
    }
  };

  const tokenCalls: Array<{
    payload: Record<string, unknown>;
    secret: string;
  }> = [];
  const jwtService = {
    signAsync: async (
      payload: Record<string, unknown>,
      options: { secret: string }
    ) => {
      tokenCalls.push({ payload, secret: options.secret });
      return options.secret === 'test-access-secret'
        ? `access-token:${String(payload.sid)}`
        : `refresh-token:${String(payload.sid)}`;
    }
  };

  try {
    const service = new AuthService(
      prisma as never,
      jwtService as never,
      {
        buildAuthenticatedUser: async (user: {
          id: string;
          email: string;
          name: string;
        }) => ({
          ...user,
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
              name: '개인 장부',
              baseCurrency: 'KRW',
              timezone: 'Asia/Seoul',
              status: 'ACTIVE'
            }
          }
        })
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
        now: () => new Date('2026-03-27T00:00:00.000Z')
      } as never,
      {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined
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

    const accessCall = tokenCalls[0];
    const refreshCall = tokenCalls[1];
    const createdSession = createdSessions[0];
    assert.ok(accessCall);
    assert.ok(refreshCall);
    assert.ok(createdSession);

    assert.equal(result.user.id, 'user-1');
    assert.equal(result.user.email, 'demo@example.com');
    assert.equal(result.user.name, 'Demo User');
    assert.deepEqual(result.user.currentWorkspace, {
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
        name: '개인 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE'
      }
    });
    assert.equal(tokenCalls.length, 2);
    assert.equal(accessCall.secret, 'test-access-secret');
    assert.equal(refreshCall.secret, 'test-refresh-secret-2');
    assert.equal(accessCall.payload.sub, 'user-1');
    assert.equal(accessCall.payload.email, 'demo@example.com');
    assert.equal(accessCall.payload.type, 'access');
    assert.equal(refreshCall.payload.sub, 'user-1');
    assert.equal(refreshCall.payload.type, 'refresh');
    assert.equal(accessCall.payload.sid, refreshCall.payload.sid);
    assert.equal(
      result.accessToken,
      `access-token:${String(accessCall.payload.sid)}`
    );
    assert.equal(
      result.refreshToken,
      `refresh-token:${String(refreshCall.payload.sid)}`
    );
    assert.equal(createdSessions.length, 1);
    assert.equal(createdSession.id, accessCall.payload.sid);
    assert.equal(createdSession.userId, 'user-1');
  } finally {
    restoreEnv();
  }
});

test('AuthService.login rejects invalid credentials', async () => {
  const restoreEnv = setJwtEnv();
  const passwordHash = await argon2.hash('Demo1234!');

  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash
      })
    },
    authSession: {
      create: async () => undefined
    }
  };

  const jwtService = {
    signAsync: async () => 'unused'
  };

  try {
    const service = new AuthService(
      prisma as never,
      jwtService as never,
      {
        buildAuthenticatedUser: async () => {
          throw new Error('should not build workspace for invalid login');
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
        now: () => new Date('2026-03-27T00:00:00.000Z')
      } as never,
      {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined
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
  } finally {
    restoreEnv();
  }
});
