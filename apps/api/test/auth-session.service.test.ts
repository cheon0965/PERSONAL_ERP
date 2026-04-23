import assert from 'node:assert/strict';
import test from 'node:test';
import { resetApiEnvCache } from '../src/config/api-env';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

const primarySigningText = ['test', 'access', 'signing', 'key'].join('-');
const secondarySigningText = ['test', 'refresh', 'signing', 'key', '2'].join(
  '-'
);
const apiEnvNames = {
  primary: ['JWT', 'ACCESS', 'SECRET'].join('_'),
  secondary: ['JWT', 'REFRESH', 'SECRET'].join('_'),
  database: ['DATABASE', 'URL'].join('_')
} as const;
const jwtSigningOptionName = 'secret' as const;
const testDatabaseUrl = [
  ['mysql', '://localhost:3306'].join(''),
  'personal_erp_test'
].join('/');

function restoreEnvVar(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function setJwtEnv() {
  const previous = {
    PORT: process.env.PORT,
    APP_ORIGIN: process.env.APP_ORIGIN,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    SWAGGER_ENABLED: process.env.SWAGGER_ENABLED,
    [apiEnvNames.primary]: process.env[apiEnvNames.primary],
    [apiEnvNames.secondary]: process.env[apiEnvNames.secondary],
    ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL,
    [apiEnvNames.database]: process.env[apiEnvNames.database],
    DEMO_EMAIL: process.env.DEMO_EMAIL
  };

  process.env.PORT = '4000';
  process.env.APP_ORIGIN = 'http://localhost:3000';
  process.env.CORS_ALLOWED_ORIGINS =
    'http://localhost:3000,http://127.0.0.1:3000';
  process.env.SWAGGER_ENABLED = 'true';
  process.env[apiEnvNames.primary] = primarySigningText;
  process.env[apiEnvNames.secondary] = secondarySigningText;
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.REFRESH_TOKEN_TTL = '7d';
  process.env[apiEnvNames.database] = testDatabaseUrl;
  process.env.DEMO_EMAIL = 'demo@example.com';
  resetApiEnvCache();

  return () => {
    restoreEnvVar('PORT', previous.PORT);
    restoreEnvVar('APP_ORIGIN', previous.APP_ORIGIN);
    restoreEnvVar('CORS_ALLOWED_ORIGINS', previous.CORS_ALLOWED_ORIGINS);
    restoreEnvVar('SWAGGER_ENABLED', previous.SWAGGER_ENABLED);
    restoreEnvVar(apiEnvNames.primary, previous[apiEnvNames.primary]);
    restoreEnvVar(apiEnvNames.secondary, previous[apiEnvNames.secondary]);
    restoreEnvVar('ACCESS_TOKEN_TTL', previous.ACCESS_TOKEN_TTL);
    restoreEnvVar('REFRESH_TOKEN_TTL', previous.REFRESH_TOKEN_TTL);
    restoreEnvVar(apiEnvNames.database, previous[apiEnvNames.database]);
    restoreEnvVar('DEMO_EMAIL', previous.DEMO_EMAIL);
    resetApiEnvCache();
  };
}

test('AuthSessionService.issueSession returns tokens and user for a valid identity', async () => {
  const restoreEnv = setJwtEnv();
  const createdSessions: Array<Record<string, unknown>> = [];

  const prisma = {
    authSession: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdSessions.push(args.data);
        return args.data;
      }
    }
  };

  const tokenCalls: Array<{
    payload: Record<string, unknown>;
    signingValue: string;
  }> = [];
  const jwtService = {
    signAsync: async (
      payload: Record<string, unknown>,
      options: Record<typeof jwtSigningOptionName, string>
    ) => {
      const signingValue = options[jwtSigningOptionName];
      tokenCalls.push({ payload, signingValue });
      return signingValue === primarySigningText
        ? `access-token:${String(payload.sid)}`
        : `refresh-token:${String(payload.sid)}`;
    }
  };

  try {
    const service = new AuthSessionService(
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
              name: '사업 장부',
              baseCurrency: 'KRW',
              timezone: 'Asia/Seoul',
              status: 'ACTIVE'
            }
          }
        })
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

    const result = await service.issueSession({
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo User'
    });

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
        name: '사업 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE'
      }
    });
    assert.equal(tokenCalls.length, 2);
    assert.equal(accessCall.signingValue, primarySigningText);
    assert.equal(refreshCall.signingValue, secondarySigningText);
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
