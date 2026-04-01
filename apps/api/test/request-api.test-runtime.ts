import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { configureApiApp } from '../src/bootstrap/configure-api-app';
import { ExternalDependenciesModule } from '../src/common/infrastructure/external-dependencies.module';
import { SecurityEventLogger } from '../src/common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { getApiEnv, resetApiEnvCache } from '../src/config/api-env';
import { AccountSubjectsModule } from '../src/modules/account-subjects/account-subjects.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AccountingPeriodsModule } from '../src/modules/accounting-periods/accounting-periods.module';
import { CarryForwardsModule } from '../src/modules/carry-forwards/carry-forwards.module';
import { CategoriesModule } from '../src/modules/categories/categories.module';
import { DashboardModule } from '../src/modules/dashboard/dashboard.module';
import { FinancialStatementsModule } from '../src/modules/financial-statements/financial-statements.module';
import { ForecastModule } from '../src/modules/forecast/forecast.module';
import { FundingAccountsModule } from '../src/modules/funding-accounts/funding-accounts.module';
import { HealthModule } from '../src/modules/health/health.module';
import { ImportBatchesModule } from '../src/modules/import-batches/import-batches.module';
import { JournalEntriesModule } from '../src/modules/journal-entries/journal-entries.module';
import { LedgerTransactionTypesModule } from '../src/modules/ledger-transaction-types/ledger-transaction-types.module';
import { RecurringRulesModule } from '../src/modules/recurring-rules/recurring-rules.module';
import { CollectedTransactionsModule } from '../src/modules/collected-transactions/collected-transactions.module';
import { createPrismaMock } from './request-api.test-prisma-mock';
import { createRequestTestState } from './request-api.test-state';
import type {
  RequestTestContext,
  RequestTestState
} from './request-api.test-types';

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
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL,
    DATABASE_URL: process.env.DATABASE_URL,
    DEMO_EMAIL: process.env.DEMO_EMAIL
  };

  process.env.PORT = '4000';
  process.env.APP_ORIGIN = 'http://localhost:3000';
  process.env.CORS_ALLOWED_ORIGINS =
    'http://localhost:3000,http://127.0.0.1:3000';
  process.env.SWAGGER_ENABLED = 'true';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-2';
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.REFRESH_TOKEN_TTL = '7d';
  process.env.DATABASE_URL =
    'mysql://test:test@localhost:3306/personal_erp_test';
  process.env.DEMO_EMAIL = 'demo@example.com';
  resetApiEnvCache();

  return () => {
    restoreEnvVar('PORT', previous.PORT);
    restoreEnvVar('APP_ORIGIN', previous.APP_ORIGIN);
    restoreEnvVar('CORS_ALLOWED_ORIGINS', previous.CORS_ALLOWED_ORIGINS);
    restoreEnvVar('SWAGGER_ENABLED', previous.SWAGGER_ENABLED);
    restoreEnvVar('JWT_ACCESS_SECRET', previous.JWT_ACCESS_SECRET);
    restoreEnvVar('JWT_REFRESH_SECRET', previous.JWT_REFRESH_SECRET);
    restoreEnvVar('ACCESS_TOKEN_TTL', previous.ACCESS_TOKEN_TTL);
    restoreEnvVar('REFRESH_TOKEN_TTL', previous.REFRESH_TOKEN_TTL);
    restoreEnvVar('DATABASE_URL', previous.DATABASE_URL);
    restoreEnvVar('DEMO_EMAIL', previous.DEMO_EMAIL);
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

    // The request tests use real controllers, the real global guard, and ValidationPipe.
    // Prisma and JWT are replaced with an in-memory fixture store so the HTTP wiring stays fast.
    const moduleRef = await Test.createTestingModule({
      imports: [
        ExternalDependenciesModule,
        HealthModule,
        AuthModule,
        AccountSubjectsModule,
        AccountingPeriodsModule,
        CarryForwardsModule,
        CategoriesModule,
        DashboardModule,
        FinancialStatementsModule,
        ForecastModule,
        FundingAccountsModule,
        JournalEntriesModule,
        LedgerTransactionTypesModule,
        CollectedTransactionsModule,
        ImportBatchesModule,
        RecurringRulesModule
      ]
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
      .overrideProvider(JwtService)
      .useValue(createJwtServiceMock(state))
      .compile();

    const app = moduleRef.createNestApplication();
    configureApiApp(app, getApiEnv());

    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not resolve the test server address.');
    }

    const baseUrl = `http://127.0.0.1:${address.port}/api`;

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
