import assert from 'node:assert/strict';
import test from 'node:test';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  RecurrenceFrequency,
  TransactionOrigin,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { configureApiApp } from '../src/bootstrap/configure-api-app';
import { ExternalDependenciesModule } from '../src/common/infrastructure/external-dependencies.module';
import { SecurityEventLogger } from '../src/common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { getApiEnv, resetApiEnvCache } from '../src/config/api-env';
import { AuthModule } from '../src/modules/auth/auth.module';
import { DashboardModule } from '../src/modules/dashboard/dashboard.module';
import { ForecastModule } from '../src/modules/forecast/forecast.module';
import { HealthModule } from '../src/modules/health/health.module';
import { RecurringRulesModule } from '../src/modules/recurring-rules/recurring-rules.module';
import { CollectedTransactionsModule } from '../src/modules/collected-transactions/collected-transactions.module';

type RequestTestUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  settings?: {
    minimumReserveWon: number | null;
    monthlySinkingFundWon: number | null;
  };
};

type RequestTestState = {
  databaseReady: boolean;
  users: RequestTestUser[];
  authSessions: Array<{
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }>;
  accounts: Array<{
    id: string;
    userId: string;
    name: string;
    balanceWon: number;
  }>;
  categories: Array<{ id: string; userId: string; name: string }>;
  transactions: Array<{
    id: string;
    userId: string;
    title: string;
    type: TransactionType;
    amountWon: number;
    businessDate: Date;
    accountId: string;
    categoryId: string;
    memo: string | null;
    origin: TransactionOrigin;
    status: TransactionStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
  recurringRules: Array<{
    id: string;
    userId: string;
    accountId: string;
    categoryId: string;
    title: string;
    amountWon: number;
    frequency: RecurrenceFrequency;
    dayOfMonth: number;
    startDate: Date;
    endDate: Date | null;
    isActive: boolean;
    nextRunDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }>;
  insurancePolicies: Array<{
    id: string;
    userId: string;
    monthlyPremiumWon: number;
    isActive: boolean;
  }>;
  vehicles: Array<{
    id: string;
    userId: string;
    monthlyExpenseWon: number;
  }>;
};

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type RequestResult = {
  status: number;
  body: unknown;
  headers: Headers;
};

type RequestTestContext = {
  state: RequestTestState;
  securityEvents: Array<{
    level: 'log' | 'warn' | 'error';
    event: string;
    details: Record<string, unknown>;
  }>;
  request: (path: string, options?: RequestOptions) => Promise<RequestResult>;
  authHeaders: (userId?: string) => Record<string, string>;
  close: () => Promise<void>;
};

const demoPasswordHashPromise = argon2.hash('Demo1234!');

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
    process.env.PORT = previous.PORT;
    process.env.APP_ORIGIN = previous.APP_ORIGIN;
    process.env.CORS_ALLOWED_ORIGINS = previous.CORS_ALLOWED_ORIGINS;
    process.env.SWAGGER_ENABLED = previous.SWAGGER_ENABLED;
    process.env.JWT_ACCESS_SECRET = previous.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = previous.JWT_REFRESH_SECRET;
    process.env.ACCESS_TOKEN_TTL = previous.ACCESS_TOKEN_TTL;
    process.env.REFRESH_TOKEN_TTL = previous.REFRESH_TOKEN_TTL;
    process.env.DATABASE_URL = previous.DATABASE_URL;
    process.env.DEMO_EMAIL = previous.DEMO_EMAIL;
    resetApiEnvCache();
  };
}

async function createRequestTestState(): Promise<RequestTestState> {
  const passwordHash = await demoPasswordHashPromise;

  return {
    databaseReady: true,
    users: [
      {
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash,
        settings: {
          minimumReserveWon: 500_000,
          monthlySinkingFundWon: 210_000
        }
      },
      {
        id: 'user-2',
        email: 'other@example.com',
        name: 'Other User',
        passwordHash,
        settings: {
          minimumReserveWon: 900_000,
          monthlySinkingFundWon: 310_000
        }
      }
    ],
    authSessions: [
      {
        id: 'session-user-1',
        userId: 'user-1',
        refreshTokenHash: 'existing-session-hash',
        expiresAt: new Date('2026-04-03T00:00:00.000Z'),
        revokedAt: null
      },
      {
        id: 'session-user-2',
        userId: 'user-2',
        refreshTokenHash: 'existing-session-hash',
        expiresAt: new Date('2026-04-03T00:00:00.000Z'),
        revokedAt: null
      }
    ],
    accounts: [
      {
        id: 'acc-1',
        userId: 'user-1',
        name: 'Main checking',
        balanceWon: 2_000_000
      },
      {
        id: 'acc-1b',
        userId: 'user-1',
        name: 'Emergency savings',
        balanceWon: 3_500_000
      },
      {
        id: 'acc-2',
        userId: 'user-2',
        name: 'Other account',
        balanceWon: 9_000_000
      }
    ],
    categories: [
      { id: 'cat-1', userId: 'user-1', name: 'Fuel' },
      { id: 'cat-1b', userId: 'user-1', name: 'Salary' },
      { id: 'cat-1c', userId: 'user-1', name: 'Utilities' },
      { id: 'cat-2', userId: 'user-2', name: 'Other category' }
    ],
    transactions: [
      {
        id: 'txn-seed-1',
        userId: 'user-1',
        title: 'March salary',
        type: TransactionType.INCOME,
        amountWon: 3_000_000,
        businessDate: new Date('2026-03-25T00:00:00.000Z'),
        accountId: 'acc-1',
        categoryId: 'cat-1b',
        memo: null,
        origin: TransactionOrigin.MANUAL,
        status: TransactionStatus.POSTED,
        createdAt: new Date('2026-03-25T09:00:00.000Z'),
        updatedAt: new Date('2026-03-25T09:00:00.000Z')
      },
      {
        id: 'txn-seed-2',
        userId: 'user-1',
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84_000,
        businessDate: new Date('2026-03-20T00:00:00.000Z'),
        accountId: 'acc-1',
        categoryId: 'cat-1',
        memo: 'Full tank',
        origin: TransactionOrigin.MANUAL,
        status: TransactionStatus.POSTED,
        createdAt: new Date('2026-03-20T08:00:00.000Z'),
        updatedAt: new Date('2026-03-20T08:00:00.000Z')
      },
      {
        id: 'txn-seed-3',
        userId: 'user-2',
        title: 'Other user expense',
        type: TransactionType.EXPENSE,
        amountWon: 777_777,
        businessDate: new Date('2026-03-18T00:00:00.000Z'),
        accountId: 'acc-2',
        categoryId: 'cat-2',
        memo: null,
        origin: TransactionOrigin.MANUAL,
        status: TransactionStatus.POSTED,
        createdAt: new Date('2026-03-18T08:00:00.000Z'),
        updatedAt: new Date('2026-03-18T08:00:00.000Z')
      }
    ],
    recurringRules: [
      {
        id: 'rr-seed-1',
        userId: 'user-1',
        accountId: 'acc-1',
        categoryId: 'cat-1c',
        title: 'Phone bill',
        amountWon: 75_000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 10,
        startDate: new Date('2026-03-10T00:00:00.000Z'),
        endDate: null,
        isActive: true,
        nextRunDate: new Date('2026-03-10T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
        updatedAt: new Date('2026-03-01T09:00:00.000Z')
      },
      {
        id: 'rr-seed-2',
        userId: 'user-2',
        accountId: 'acc-2',
        categoryId: 'cat-2',
        title: 'Other user recurring rule',
        amountWon: 333_333,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 15,
        startDate: new Date('2026-03-15T00:00:00.000Z'),
        endDate: null,
        isActive: true,
        nextRunDate: new Date('2026-03-15T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        updatedAt: new Date('2026-03-01T10:00:00.000Z')
      }
    ],
    insurancePolicies: [
      {
        id: 'policy-1',
        userId: 'user-1',
        monthlyPremiumWon: 42_000,
        isActive: true
      },
      {
        id: 'policy-2',
        userId: 'user-2',
        monthlyPremiumWon: 250_000,
        isActive: true
      }
    ],
    vehicles: [
      {
        id: 'vehicle-1',
        userId: 'user-1',
        monthlyExpenseWon: 130_000
      },
      {
        id: 'vehicle-2',
        userId: 'user-2',
        monthlyExpenseWon: 410_000
      }
    ]
  };
}

function createPrismaMock(state: RequestTestState) {
  const sortTransactions = (
    items: RequestTestState['transactions']
  ): RequestTestState['transactions'] =>
    [...items].sort((left, right) => {
      if (left.businessDate.getTime() !== right.businessDate.getTime()) {
        return right.businessDate.getTime() - left.businessDate.getTime();
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });

  const sortRecurringRules = (
    items: RequestTestState['recurringRules']
  ): RequestTestState['recurringRules'] =>
    [...items].sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return Number(right.isActive) - Number(left.isActive);
      }

      return left.nextRunDate.getTime() - right.nextRunDate.getTime();
    });

  const findUser = (where: { email?: string; id?: string }) =>
    state.users.find((candidate) => {
      const { email, id } = where;
      return (
        (!email || candidate.email === email) && (!id || candidate.id === id)
      );
    });

  const projectUser = (
    user: RequestTestUser,
    select?:
      | {
          id?: boolean;
          email?: boolean;
          name?: boolean;
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
            };
          };
        }
      | undefined
  ) => {
    if (!select) {
      return user;
    }

    const projected: Record<string, unknown> = {};

    if (select.id) {
      projected.id = user.id;
    }

    if (select.email) {
      projected.email = user.email;
    }

    if (select.name) {
      projected.name = user.name;
    }

    if (select.settings) {
      projected.settings = user.settings
        ? {
            minimumReserveWon: select.settings.select?.minimumReserveWon
              ? user.settings.minimumReserveWon
              : undefined,
            monthlySinkingFundWon: select.settings.select?.monthlySinkingFundWon
              ? user.settings.monthlySinkingFundWon
              : undefined
          }
        : null;
    }

    return projected;
  };

  const resolveAccount = (accountId: string) =>
    state.accounts.find((candidate) => candidate.id === accountId) ?? null;
  const resolveCategory = (categoryId: string) =>
    state.categories.find((candidate) => candidate.id === categoryId) ?? null;

  return {
    $queryRaw: async () => {
      if (!state.databaseReady) {
        throw new Error('Database unavailable');
      }

      return [{ ready: 1 }];
    },
    user: {
      findUnique: async (args: {
        where: { email?: string; id?: string };
        select?: {
          id?: boolean;
          email?: boolean;
          name?: boolean;
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
            };
          };
        };
      }) => {
        const user = findUser(args.where);

        if (!user) {
          return null;
        }

        return projectUser(user, args.select);
      },
      findUniqueOrThrow: async (args: {
        where: { id: string };
        select?: {
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
            };
          };
        };
      }) => {
        const user = findUser(args.where);

        if (!user) {
          throw new Error('User not found');
        }

        return projectUser(user, args.select);
      }
    },
    authSession: {
      create: async (args: {
        data: {
          id: string;
          userId: string;
          refreshTokenHash: string;
          expiresAt: Date;
        };
      }) => {
        const created = {
          ...args.data,
          revokedAt: null
        };
        state.authSessions.push(created);
        return created;
      },
      findUnique: async (args: { where: { id: string } }) => {
        return (
          state.authSessions.find(
            (candidate) => candidate.id === args.where.id
          ) ?? null
        );
      },
      updateMany: async (args: {
        where: {
          id?: string;
          userId?: string;
          revokedAt?: null;
        };
        data: {
          revokedAt?: Date | null;
        };
      }) => {
        let count = 0;

        state.authSessions = state.authSessions.map((candidate) => {
          const matchesId = !args.where.id || candidate.id === args.where.id;
          const matchesUser =
            !args.where.userId || candidate.userId === args.where.userId;
          const matchesRevoked =
            args.where.revokedAt === undefined ||
            candidate.revokedAt === args.where.revokedAt;

          if (!(matchesId && matchesUser && matchesRevoked)) {
            return candidate;
          }

          count += 1;
          return {
            ...candidate,
            ...args.data
          };
        });

        return { count };
      }
    },
    account: {
      findFirst: async (args: { where: { id: string; userId: string } }) => {
        const account = state.accounts.find(
          (candidate) =>
            candidate.id === args.where.id &&
            candidate.userId === args.where.userId
        );

        return account ? { id: account.id } : null;
      },
      findMany: async (args: {
        where?: { userId?: string };
        select?: { balanceWon?: boolean };
      }) => {
        const items = state.accounts.filter(
          (candidate) =>
            !args.where?.userId || candidate.userId === args.where.userId
        );

        if (args.select?.balanceWon) {
          return items.map((candidate) => ({
            balanceWon: candidate.balanceWon
          }));
        }

        return items;
      }
    },
    category: {
      findFirst: async (args: { where: { id: string; userId: string } }) => {
        const category = state.categories.find(
          (candidate) =>
            candidate.id === args.where.id &&
            candidate.userId === args.where.userId
        );

        return category ? { id: category.id } : null;
      }
    },
    transaction: {
      findMany: async (args: {
        where?: { userId?: string; status?: TransactionStatus };
        include?: { account?: boolean; category?: boolean };
        select?: { type?: boolean; amountWon?: boolean };
        orderBy?: Array<{
          businessDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.transactions.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesStatus =
            !args.where?.status || candidate.status === args.where.status;
          return matchesUser && matchesStatus;
        });

        items = sortTransactions(items);

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) => {
          if (args.select) {
            return {
              ...(args.select.type ? { type: candidate.type } : {}),
              ...(args.select.amountWon
                ? { amountWon: candidate.amountWon }
                : {})
            };
          }

          const account = resolveAccount(candidate.accountId);
          const category = resolveCategory(candidate.categoryId);

          if (args.include) {
            return {
              ...candidate,
              account: args.include.account ? account : undefined,
              category: args.include.category ? category : undefined
            };
          }

          return candidate;
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const account = resolveAccount(String(args.data.accountId));
        const category = resolveCategory(String(args.data.categoryId));
        const created = {
          id: `txn-${state.transactions.length + 1}`,
          userId: String(args.data.userId),
          title: String(args.data.title),
          type: args.data.type as TransactionType,
          amountWon: Number(args.data.amountWon),
          businessDate: new Date(String(args.data.businessDate)),
          accountId: String(args.data.accountId),
          categoryId: String(args.data.categoryId),
          memo: args.data.memo === undefined ? null : String(args.data.memo),
          origin: args.data.origin as TransactionOrigin,
          status: args.data.status as TransactionStatus,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.transactions.push(created);
        return {
          ...created,
          account,
          category
        };
      }
    },
    recurringRule: {
      findMany: async (args: {
        where?: { userId?: string; isActive?: boolean };
        include?: { account?: boolean; category?: boolean };
        select?: { amountWon?: boolean };
        orderBy?: Array<{
          isActive?: 'asc' | 'desc';
          nextRunDate?: 'asc' | 'desc';
        }>;
      }) => {
        let items = state.recurringRules.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;
          return matchesUser && matchesActive;
        });

        items = sortRecurringRules(items);

        return items.map((candidate) => {
          if (args.select) {
            return {
              ...(args.select.amountWon
                ? { amountWon: candidate.amountWon }
                : {})
            };
          }

          const account = resolveAccount(candidate.accountId);
          const category = resolveCategory(candidate.categoryId);

          if (args.include) {
            return {
              ...candidate,
              account: args.include.account ? account : undefined,
              category: args.include.category ? category : undefined
            };
          }

          return candidate;
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const account = resolveAccount(String(args.data.accountId));
        const category = resolveCategory(String(args.data.categoryId));
        const created = {
          id: `rr-${state.recurringRules.length + 1}`,
          userId: String(args.data.userId),
          accountId: String(args.data.accountId),
          categoryId: String(args.data.categoryId),
          title: String(args.data.title),
          amountWon: Number(args.data.amountWon),
          frequency: args.data.frequency as RecurrenceFrequency,
          dayOfMonth: Number(args.data.dayOfMonth),
          startDate: new Date(String(args.data.startDate)),
          endDate:
            args.data.endDate === undefined || args.data.endDate === null
              ? null
              : new Date(String(args.data.endDate)),
          isActive: Boolean(args.data.isActive),
          nextRunDate: new Date(String(args.data.nextRunDate)),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.recurringRules.push(created);
        return {
          ...created,
          account,
          category
        };
      }
    },
    insurancePolicy: {
      findMany: async (args: {
        where?: { userId?: string; isActive?: boolean };
        select?: { monthlyPremiumWon?: boolean };
      }) => {
        const items = state.insurancePolicies.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;
          return matchesUser && matchesActive;
        });

        if (args.select?.monthlyPremiumWon) {
          return items.map((candidate) => ({
            monthlyPremiumWon: candidate.monthlyPremiumWon
          }));
        }

        return items;
      }
    },
    vehicle: {
      findMany: async (args: {
        where?: { userId?: string };
        select?: { monthlyExpenseWon?: boolean };
      }) => {
        const items = state.vehicles.filter(
          (candidate) =>
            !args.where?.userId || candidate.userId === args.where.userId
        );

        if (args.select?.monthlyExpenseWon) {
          return items.map((candidate) => ({
            monthlyExpenseWon: candidate.monthlyExpenseWon
          }));
        }

        return items;
      }
    }
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

function readSetCookieHeader(headers: Headers): string {
  const headerBag = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headerBag.getSetCookie === 'function') {
    return headerBag.getSetCookie().join('; ');
  }

  return headers.get('set-cookie') ?? '';
}

function readCookieValue(headers: Headers, cookieName: string): string | null {
  const setCookie = readSetCookieHeader(headers);
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`, 'i'));
  return match?.[1] ?? null;
}

async function createRequestTestContext(): Promise<RequestTestContext> {
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
        DashboardModule,
        ForecastModule,
        CollectedTransactionsModule,
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

test('POST /auth/login returns access token and a refresh cookie for valid credentials', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });

    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-request-id') ?? '', /.+/);
    assert.match(
      (response.body as { accessToken: string }).accessToken,
      /^test-access-token:[^:]+:user-1$/
    );
    assert.deepEqual((response.body as { user: unknown }).user, {
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo User'
    });
    assert.match(readSetCookieHeader(response.headers), /refreshToken=/);
    assert.match(readSetCookieHeader(response.headers), /HttpOnly/i);
    assert.match(readSetCookieHeader(response.headers), /SameSite=Strict/i);
    assert.match(readSetCookieHeader(response.headers), /Path=\/api\/auth/i);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.login_succeeded' &&
          candidate.details.userId === 'user-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/refresh rotates the refresh session and returns a new access token', async () => {
  const context = await createRequestTestContext();

  try {
    const loginResponse = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });
    const originalRefreshToken = readCookieValue(
      loginResponse.headers,
      'refreshToken'
    );

    assert.ok(originalRefreshToken);

    const response = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${originalRefreshToken}`
      }
    });

    const rotatedRefreshToken = readCookieValue(
      response.headers,
      'refreshToken'
    );
    assert.equal(response.status, 200);
    assert.ok(rotatedRefreshToken);
    assert.notEqual(rotatedRefreshToken, originalRefreshToken);
    assert.match(
      (response.body as { accessToken: string }).accessToken,
      /^test-access-token:[^:]+:user-1$/
    );

    const activeSessions = context.state.authSessions.filter(
      (candidate) =>
        candidate.userId === 'user-1' && candidate.revokedAt === null
    );
    const revokedSessions = context.state.authSessions.filter(
      (candidate) =>
        candidate.userId === 'user-1' && candidate.revokedAt !== null
    );
    assert.equal(activeSessions.length, 2);
    assert.equal(revokedSessions.length, 1);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.refresh_succeeded' &&
          candidate.details.userId === 'user-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/refresh returns 401 when the refresh cookie is missing', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/refresh', {
      method: 'POST'
    });

    assert.equal(response.status, 401);
    assert.equal(
      (response.body as { message: string }).message,
      'Missing refresh token'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.refresh_failed' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.reason === 'missing_refresh_token'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/logout revokes the current refresh session and clears the cookie', async () => {
  const context = await createRequestTestContext();

  try {
    const loginResponse = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });
    const refreshToken = readCookieValue(loginResponse.headers, 'refreshToken');
    assert.ok(refreshToken);

    const logoutResponse = await context.request('/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${refreshToken}`
      }
    });

    assert.equal(logoutResponse.status, 200);
    assert.equal(
      (logoutResponse.body as { status: string }).status,
      'logged_out'
    );
    assert.match(readSetCookieHeader(logoutResponse.headers), /refreshToken=/);

    const refreshResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${refreshToken}`
      }
    });

    assert.equal(refreshResponse.status, 401);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.logout_succeeded' &&
          candidate.details.userId === 'user-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/refresh revokes all active sessions when a rotated refresh token is reused', async () => {
  const context = await createRequestTestContext();

  try {
    const loginResponse = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });
    const originalRefreshToken = readCookieValue(
      loginResponse.headers,
      'refreshToken'
    );
    assert.ok(originalRefreshToken);

    const rotatedResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${originalRefreshToken}`
      }
    });
    assert.equal(rotatedResponse.status, 200);

    const reuseResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${originalRefreshToken}`
      }
    });

    assert.equal(reuseResponse.status, 401);
    assert.equal(
      context.state.authSessions.some(
        (candidate) =>
          candidate.userId === 'user-1' && candidate.revokedAt === null
      ),
      false
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.refresh_reuse_detected' &&
          candidate.details.userId === 'user-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('GET /health echoes an incoming x-request-id header', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/health', {
      headers: {
        'x-request-id': 'manual-request-id-123'
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-request-id'), 'manual-request-id-123');
    assert.equal((response.body as { status: string }).status, 'ok');
  } finally {
    await context.close();
  }
});

test('GET /health applies the browser boundary headers for allowed origins', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/health', {
      headers: {
        origin: 'http://localhost:3000'
      }
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:3000'
    );
    assert.equal(
      response.headers.get('access-control-allow-credentials'),
      'true'
    );
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(
      response.headers.get('permissions-policy'),
      'camera=(), geolocation=(), microphone=()'
    );
    assert.equal(
      response.headers.get('cross-origin-opener-policy'),
      'same-origin'
    );
    assert.equal(
      response.headers.get('cross-origin-resource-policy'),
      'same-site'
    );
    assert.match(
      response.headers.get('content-security-policy') ?? '',
      /default-src 'none'/
    );
    assert.equal(response.headers.get('strict-transport-security'), null);
  } finally {
    await context.close();
  }
});

test('GET /health/ready reports database readiness when Prisma is reachable', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/health/ready');

    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-request-id') ?? '', /.+/);
    assert.deepEqual(response.body, {
      status: 'ready',
      timestamp: (response.body as { timestamp: string }).timestamp,
      checks: {
        database: 'ok'
      }
    });
  } finally {
    await context.close();
  }
});

test('GET /health/ready returns 503 and logs a readiness failure when Prisma is unreachable', async () => {
  const context = await createRequestTestContext();
  context.state.databaseReady = false;

  try {
    const response = await context.request('/health/ready');

    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {
      status: 'not_ready',
      timestamp: (response.body as { timestamp: string }).timestamp,
      checks: {
        database: 'error'
      }
    });
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'error' &&
          candidate.event === 'system.readiness_failed' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.check === 'database'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/login returns 401 for invalid credentials', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'WrongPassword!'
      }
    });

    assert.equal(response.status, 401);
    assert.equal(
      (response.body as { message: string }).message,
      '이메일 또는 비밀번호가 올바르지 않습니다.'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.login_failed' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.reason === 'invalid_credentials'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/login returns 403 for disallowed browser origins', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://evil.example.com',
        referer: 'http://evil.example.com/login'
      },
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });

    assert.equal(response.status, 403);
    assert.equal(
      (response.body as { message: string }).message,
      'Origin not allowed'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.browser_origin_blocked' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.reason === 'origin_not_allowed'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/login returns 429 after too many invalid attempts from the same client', async () => {
  const context = await createRequestTestContext();

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await context.request('/auth/login', {
        method: 'POST',
        body: {
          email: 'demo@example.com',
          password: 'WrongPassword!'
        }
      });

      assert.equal(response.status, 401);
    }

    const response = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'WrongPassword!'
      }
    });

    assert.equal(response.status, 429);
    assert.equal(
      (response.body as { message: string }).message,
      '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.login_rate_limited' &&
          candidate.details.requestId === response.headers.get('x-request-id')
      )
    );
  } finally {
    await context.close();
  }
});

test('GET /collected-transactions returns 401 when the bearer token is missing', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/collected-transactions');

    assert.equal(response.status, 401);
    assert.equal(
      (response.body as { message: string }).message,
      'Missing bearer token'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.access_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.reason === 'missing_bearer_token'
      )
    );
  } finally {
    await context.close();
  }
});

test('GET /auth/me returns the authenticated user', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/me', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo User'
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
  } finally {
    await context.close();
  }
});

test('GET /collected-transactions returns only the current user collected transaction items without internal ownership fields', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/collected-transactions', {
      headers: context.authHeaders()
    });

    const items = response.body as Array<Record<string, unknown>>;

    assert.equal(response.status, 200);
    assert.equal(items.length, 2);
    assert.deepEqual(items, [
      {
        id: 'txn-seed-1',
        businessDate: '2026-03-25',
        title: 'March salary',
        type: TransactionType.INCOME,
        amountWon: 3_000_000,
        fundingAccountName: 'Main checking',
        categoryName: 'Salary',
        sourceKind: TransactionOrigin.MANUAL,
        postingStatus: TransactionStatus.POSTED
      },
      {
        id: 'txn-seed-2',
        businessDate: '2026-03-20',
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84_000,
        fundingAccountName: 'Main checking',
        categoryName: 'Fuel',
        sourceKind: TransactionOrigin.MANUAL,
        postingStatus: TransactionStatus.POSTED
      }
    ]);
    assert.equal(
      items.some((candidate) => 'userId' in candidate),
      false
    );
    assert.equal(
      items.some((candidate) => 'fundingAccountId' in candidate),
      false
    );
    assert.equal(
      items.some((candidate) => 'categoryId' in candidate),
      false
    );
    assert.equal(
      items.some((candidate) => 'memo' in candidate),
      false
    );
  } finally {
    await context.close();
  }
});

test('GET /recurring-rules returns only the current user recurring rule items without internal ownership fields', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/recurring-rules', {
      headers: context.authHeaders()
    });

    const items = response.body as Array<Record<string, unknown>>;

    assert.equal(response.status, 200);
    assert.deepEqual(items, [
      {
        id: 'rr-seed-1',
        title: 'Phone bill',
        amountWon: 75_000,
        frequency: RecurrenceFrequency.MONTHLY,
        nextRunDate: '2026-03-10',
        fundingAccountName: 'Main checking',
        categoryName: 'Utilities',
        isActive: true
      }
    ]);
    assert.equal(
      items.some((candidate) => 'userId' in candidate),
      false
    );
    assert.equal(
      items.some((candidate) => 'fundingAccountId' in candidate),
      false
    );
    assert.equal(
      items.some((candidate) => 'categoryId' in candidate),
      false
    );
  } finally {
    await context.close();
  }
});

test('GET /dashboard/summary returns only aggregated data for the authenticated user', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/dashboard/summary', {
      headers: context.authHeaders()
    });

    const summary = response.body as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.deepEqual(summary, {
      month: '2026-03',
      actualBalanceWon: 5_500_000,
      confirmedIncomeWon: 3_000_000,
      confirmedExpenseWon: 84_000,
      remainingRecurringWon: 75_000,
      insuranceMonthlyWon: 42_000,
      vehicleMonthlyWon: 130_000,
      expectedMonthEndBalanceWon: 5_425_000,
      safetySurplusWon: 4_925_000
    });
    assert.equal('accounts' in summary, false);
    assert.equal('transactions' in summary, false);
    assert.equal('recurringRules' in summary, false);
    assert.equal('minimumReserveWon' in summary, false);
  } finally {
    await context.close();
  }
});

test('GET /forecast/monthly returns only aggregated forecast data for the authenticated user and respects the month query', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/forecast/monthly?month=2026-04', {
      headers: context.authHeaders()
    });

    const forecast = response.body as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.deepEqual(forecast, {
      month: '2026-04',
      actualBalanceWon: 5_500_000,
      expectedIncomeWon: 0,
      confirmedExpenseWon: 84_000,
      remainingRecurringWon: 75_000,
      sinkingFundWon: 210_000,
      minimumReserveWon: 500_000,
      expectedMonthEndBalanceWon: 5_215_000,
      safetySurplusWon: 4_715_000,
      notes: [
        'Recurring income auto-forecast is not included in the MVP baseline yet.',
        'Irregular spending buffer is modeled as a monthly sinking fund.'
      ]
    });
    assert.equal('accounts' in forecast, false);
    assert.equal('transactions' in forecast, false);
    assert.equal('recurringRules' in forecast, false);
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions returns 400 when the request body fails DTO validation', async () => {
  const context = await createRequestTestContext();

  try {
    const initialTransactionCount = context.state.transactions.length;
    const response = await context.request('/collected-transactions', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 0,
        businessDate: 'not-a-date',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1'
      }
    });

    assert.equal(response.status, 400);
    assert.match(
      JSON.stringify((response.body as { message: string[] }).message),
      /amountWon must not be less than 1/
    );
    assert.equal(context.state.transactions.length, initialTransactionCount);
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions returns 404 when the funding account is outside the current user scope', async () => {
  const context = await createRequestTestContext();

  try {
    const initialTransactionCount = context.state.transactions.length;
    const response = await context.request('/collected-transactions', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84000,
        businessDate: '2026-03-03',
        fundingAccountId: 'acc-2',
        categoryId: 'cat-1',
        memo: 'Full tank'
      }
    });

    assert.equal(response.status, 404);
    assert.equal(
      (response.body as { message: string }).message,
      'Funding account not found'
    );
    assert.equal(context.state.transactions.length, initialTransactionCount);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.scope_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.userId === 'user-1' &&
          candidate.details.resource === 'collected_transaction_funding_account'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions returns the created collected transaction item shape', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/collected-transactions', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84000,
        businessDate: '2026-03-03',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        memo: 'Full tank'
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'txn-4',
      businessDate: '2026-03-03',
      title: 'Fuel refill',
      type: TransactionType.EXPENSE,
      amountWon: 84000,
      fundingAccountName: 'Main checking',
      categoryName: 'Fuel',
      sourceKind: 'MANUAL',
      postingStatus: 'POSTED'
    });
    assert.equal(context.state.transactions.length, 4);
  } finally {
    await context.close();
  }
});

test('POST /recurring-rules returns 400 when the request body fails DTO validation', async () => {
  const context = await createRequestTestContext();

  try {
    const initialRecurringRuleCount = context.state.recurringRules.length;
    const response = await context.request('/recurring-rules', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        amountWon: 0,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 0,
        startDate: 'not-a-date',
        isActive: true
      }
    });

    assert.equal(response.status, 400);
    assert.match(
      JSON.stringify((response.body as { message: string[] }).message),
      /dayOfMonth must not be less than 1/
    );
    assert.equal(
      context.state.recurringRules.length,
      initialRecurringRuleCount
    );
  } finally {
    await context.close();
  }
});

test('POST /recurring-rules returns 404 when the category is outside the current user scope', async () => {
  const context = await createRequestTestContext();

  try {
    const initialRecurringRuleCount = context.state.recurringRules.length;
    const response = await context.request('/recurring-rules', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-2',
        amountWon: 75000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 10,
        startDate: '2026-03-10',
        isActive: true
      }
    });

    assert.equal(response.status, 404);
    assert.equal(
      (response.body as { message: string }).message,
      'Category not found'
    );
    assert.equal(
      context.state.recurringRules.length,
      initialRecurringRuleCount
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.scope_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.userId === 'user-1' &&
          candidate.details.resource === 'recurring_rule_category'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /recurring-rules returns the created recurring rule item shape', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/recurring-rules', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        title: 'Phone bill',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        amountWon: 75000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 10,
        startDate: '2026-03-10',
        isActive: true
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'rr-3',
      title: 'Phone bill',
      amountWon: 75000,
      frequency: RecurrenceFrequency.MONTHLY,
      nextRunDate: '2026-03-10',
      fundingAccountName: 'Main checking',
      categoryName: 'Fuel',
      isActive: true
    });
    assert.equal(context.state.recurringRules.length, 3);
  } finally {
    await context.close();
  }
});
