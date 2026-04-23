import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { configureApiApp } from '../src/bootstrap/configure-api-app';
import { EmailSenderPort } from '../src/common/application/ports/email-sender.port';
import { SecurityEventLogger } from '../src/common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { getApiEnv, resetApiEnvCache } from '../src/config/api-env';
import { listenOnSafeTestPort } from './http-test-port';
import { createPrismaMock } from './request-api.test-prisma-mock';
import { createRequestTestState } from './request-api.test-state';
import type {
  RequestTestContext,
  RequestTestState
} from './request-api.test-types';

const primarySigningText = ['test', 'access', 'signing', 'key'].join('-');
const secondarySigningText = ['test', 'refresh', 'signing', 'key', '2'].join(
  '-'
);
const apiEnvNames = {
  primary: ['JWT', 'ACCESS', 'SECRET'].join('_'),
  secondary: ['JWT', 'REFRESH', 'SECRET'].join('_'),
  database: ['DATABASE', 'URL'].join('_')
} as const;
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
    EMAIL_VERIFICATION_TTL: process.env.EMAIL_VERIFICATION_TTL,
    [apiEnvNames.database]: process.env[apiEnvNames.database],
    DEMO_EMAIL: process.env.DEMO_EMAIL,
    MAIL_PROVIDER: process.env.MAIL_PROVIDER,
    MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL,
    MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
    GMAIL_SENDER_EMAIL: process.env.GMAIL_SENDER_EMAIL
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
  process.env.EMAIL_VERIFICATION_TTL = '30m';
  process.env[apiEnvNames.database] = testDatabaseUrl;
  process.env.DEMO_EMAIL = 'demo@example.com';
  process.env.MAIL_PROVIDER = 'console';
  process.env.MAIL_FROM_EMAIL = 'no-reply@example.com';
  process.env.MAIL_FROM_NAME = 'PERSONAL_ERP';
  process.env.GMAIL_CLIENT_ID = '';
  process.env.GMAIL_CLIENT_SECRET = '';
  process.env.GMAIL_REFRESH_TOKEN = '';
  process.env.GMAIL_SENDER_EMAIL = '';
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
    restoreEnvVar('EMAIL_VERIFICATION_TTL', previous.EMAIL_VERIFICATION_TTL);
    restoreEnvVar(apiEnvNames.database, previous[apiEnvNames.database]);
    restoreEnvVar('DEMO_EMAIL', previous.DEMO_EMAIL);
    restoreEnvVar('MAIL_PROVIDER', previous.MAIL_PROVIDER);
    restoreEnvVar('MAIL_FROM_EMAIL', previous.MAIL_FROM_EMAIL);
    restoreEnvVar('MAIL_FROM_NAME', previous.MAIL_FROM_NAME);
    restoreEnvVar('GMAIL_CLIENT_ID', previous.GMAIL_CLIENT_ID);
    restoreEnvVar('GMAIL_CLIENT_SECRET', previous.GMAIL_CLIENT_SECRET);
    restoreEnvVar('GMAIL_REFRESH_TOKEN', previous.GMAIL_REFRESH_TOKEN);
    restoreEnvVar('GMAIL_SENDER_EMAIL', previous.GMAIL_SENDER_EMAIL);
    resetApiEnvCache();
  };
}

function createJwtServiceMock(state: RequestTestState) {
  return {
    signAsync: async (payload: {
      sub?: string;
      email?: string;
      sid?: string;
      type?: 'access' | 'refresh';
    }) => {
      const userId = String(payload.sub);
      const sessionId = String(payload.sid);
      return payload.type === 'access'
        ? `test-access-token:${sessionId}:${userId}`
        : `test-refresh-token:${sessionId}:${userId}`;
    },
    verifyAsync: async <TPayload>(token: string) => {
      const accessPrefix = 'test-access-token:';
      const refreshPrefix = 'test-refresh-token:';

      if (token.startsWith(accessPrefix)) {
        const [sessionId, userId] = token.slice(accessPrefix.length).split(':');
        const user = state.users.find((candidate) => candidate.id === userId);
        if (!user || !sessionId) {
          throw new Error('Invalid access token');
        }

        return {
          sub: user.id,
          email: user.email,
          sid: sessionId,
          type: 'access'
        } as TPayload;
      }

      if (token.startsWith(refreshPrefix)) {
        const [sessionId, userId] = token
          .slice(refreshPrefix.length)
          .split(':');
        const user = state.users.find((candidate) => candidate.id === userId);
        if (!user || !sessionId) {
          throw new Error('Invalid refresh token');
        }

        return {
          sub: user.id,
          sid: sessionId,
          type: 'refresh'
        } as TPayload;
      }

      throw new Error('Invalid token');
    }
  };
}

export function readSetCookieHeader(headers: Headers): string {
  const headerBag = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headerBag.getSetCookie === 'function') {
    return headerBag.getSetCookie().join('; ');
  }

  return headers.get('set-cookie') ?? '';
}

export function readCookieValue(
  headers: Headers,
  cookieName: string
): string | null {
  const setCookie = readSetCookieHeader(headers);
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`, 'i'));
  return match?.[1] ?? null;
}

export async function createRequestTestContext(): Promise<RequestTestContext> {
  const restoreEnv = setJwtEnv();

  try {
    const state = await createRequestTestState();
    const securityEvents: RequestTestContext['securityEvents'] = [];
    const { AppModule } = await import('../src/app.module');

    // The request tests use real controllers, the real global guard, and ValidationPipe.
    // Prisma and JWT are replaced with an in-memory fixture store so the HTTP wiring stays fast.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock(state))
      .overrideProvider(SecurityEventLogger)
      .useValue({
        log: (event: string, details: Record<string, unknown> = {}) => {
          securityEvents.push({ level: 'log', event, details });
        },
        warn: (event: string, details: Record<string, unknown> = {}) => {
          securityEvents.push({ level: 'warn', event, details });
        },
        error: (event: string, details: Record<string, unknown> = {}) => {
          securityEvents.push({ level: 'error', event, details });
        }
      })
      .overrideProvider(EmailSenderPort)
      .useValue({
        send: async (message: {
          to: string;
          subject: string;
          text: string;
          html?: string;
        }) => {
          state.sentEmails.push(message);
        }
      })
      .overrideProvider(JwtService)
      .useValue(createJwtServiceMock(state))
      .compile();

    const app = moduleRef.createNestApplication();
    configureApiApp(app, getApiEnv());

    const port = await listenOnSafeTestPort(app);
    const baseUrl = `http://127.0.0.1:${port}/api`;

    return {
      state,
      securityEvents,
      authHeaders: (userId = 'user-1') => {
        const activeSession = [...state.authSessions]
          .reverse()
          .find(
            (candidate) =>
              candidate.userId === userId && candidate.revokedAt === null
          );

        if (!activeSession) {
          throw new Error(`No active auth session available for ${userId}.`);
        }

        return {
          authorization: `Bearer test-access-token:${activeSession.id}:${userId}`
        };
      },
      request: async (path, options = {}) => {
        const headers = new Headers(options.headers);
        let body: string | undefined;

        if (options.body !== undefined) {
          headers.set('content-type', 'application/json');
          body = JSON.stringify(options.body);
        }

        const response = await fetch(`${baseUrl}${path}`, {
          method: options.method ?? (body ? 'POST' : 'GET'),
          headers,
          body
        });

        const text = await response.text();
        let parsedBody: unknown = null;

        if (text) {
          try {
            parsedBody = JSON.parse(text) as unknown;
          } catch {
            parsedBody = text;
          }
        }

        return {
          status: response.status,
          body: parsedBody,
          headers: response.headers
        };
      },
      requestFormData: async (path, options) => {
        const headers = new Headers(options.headers);
        const response = await fetch(`${baseUrl}${path}`, {
          method: options.method ?? 'POST',
          headers,
          body: options.body
        });

        const text = await response.text();
        let parsedBody: unknown = null;

        if (text) {
          try {
            parsedBody = JSON.parse(text) as unknown;
          } catch {
            parsedBody = text;
          }
        }

        return {
          status: response.status,
          body: parsedBody,
          headers: response.headers
        };
      },
      close: async () => {
        await app.close();
        restoreEnv();
      }
    };
  } catch (error) {
    restoreEnv();
    throw error;
  }
}
