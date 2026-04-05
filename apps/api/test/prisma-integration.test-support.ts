import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import * as argon2 from 'argon2';
import { Test } from '@nestjs/testing';
import { AccountType, CategoryKind } from '@prisma/client';
import { configureApiApp } from '../src/bootstrap/configure-api-app';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { getApiEnv, resetApiEnvCache } from '../src/config/api-env';
import { ensurePhase1BackboneForUser } from '../prisma/phase1-backbone';

const integrationPassword = 'Integration1234!';
const integrationPasswordHashPromise = argon2.hash(integrationPassword);

export const shouldRunPrismaIntegration =
  process.env.RUN_PRISMA_INTEGRATION === '1';

type ApiRequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
};

type ApiResponse = {
  status: number;
  body: unknown;
  headers: Headers;
};

export type RealApiPrismaIntegrationContext = {
  prisma: PrismaService;
  request(path: string, options?: ApiRequestOptions): Promise<ApiResponse>;
  login(email: string, password: string): Promise<{
    accessToken: string;
    headers: Headers;
    user: unknown;
  }>;
  close(): Promise<void>;
};

export type IntegrationWorkspaceFixture = {
  userId: string;
  tenantId: string;
  ledgerId: string;
  membershipId: string;
  email: string;
  password: string;
  fundingAccountId: string;
  fundingAccountName: string;
  expenseCategoryId: string;
  expenseCategoryName: string;
  assetAccountSubjectId: string;
  equityAccountSubjectId: string;
};

export async function createRealApiPrismaIntegrationContext(
  t: TestContext
): Promise<RealApiPrismaIntegrationContext | null> {
  if (!shouldRunPrismaIntegration) {
    t.skip(
      'Run `npm run test:prisma` to execute this test against a configured MySQL database.'
    );
    return null;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    t.skip(
      'Skipping Prisma integration test because DATABASE_URL is not configured.'
    );
    return null;
  }

  const restoreEnv = setRealApiEnv(databaseUrl);
  const connectivityProbe = new PrismaService();

  try {
    await connectivityProbe.$connect();
  } catch {
    restoreEnv();
    t.skip(
      'Skipping Prisma integration test because DATABASE_URL is not reachable from this environment.'
    );
    return null;
  } finally {
    await safeDisconnect(connectivityProbe);
  }

  try {
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    const app = moduleRef.createNestApplication();

    configureApiApp(app, getApiEnv());
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not resolve the Prisma integration server address.');
    }

    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const prisma = app.get(PrismaService);

    return {
      prisma,
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
      login: async (email, password) => {
        const response = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const body = (await response.json()) as {
          accessToken?: string;
          user?: unknown;
        };

        if (response.status !== 200 || !body.accessToken) {
          throw new Error(
            `Expected /auth/login to succeed for ${email}, but received ${response.status}.`
          );
        }

        return {
          accessToken: body.accessToken,
          headers: response.headers,
          user: body.user ?? null
        };
      },
      close: async () => {
        try {
          await app.close();
        } finally {
          await safeDisconnect(prisma);
          restoreEnv();
        }
      }
    };
  } catch (error) {
    restoreEnv();
    throw error;
  }
}

export async function createIntegrationWorkspaceFixture(
  prisma: PrismaService,
  input?: {
    prefix?: string;
    fundingAccountName?: string;
    expenseCategoryName?: string;
  }
): Promise<IntegrationWorkspaceFixture> {
  const suffix = randomUUID();
  const email = `${input?.prefix ?? 'prisma-flow'}-${suffix}@example.com`;
  const passwordHash = await integrationPasswordHashPromise;
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Prisma Workflow Owner',
      passwordHash
    }
  });
  const backbone = await ensurePhase1BackboneForUser(prisma, user.id);
  const fundingAccountName =
    input?.fundingAccountName ?? 'Prisma Integration Main Account';
  const expenseCategoryName =
    input?.expenseCategoryName ?? 'Prisma Integration Expense';
  const fundingAccount = await prisma.account.create({
    data: {
      userId: user.id,
      tenantId: backbone.tenantId,
      ledgerId: backbone.ledgerId,
      name: fundingAccountName,
      type: AccountType.BANK,
      balanceWon: 2_000_000,
      sortOrder: 1
    }
  });
  const expenseCategory = await prisma.category.create({
    data: {
      userId: user.id,
      tenantId: backbone.tenantId,
      ledgerId: backbone.ledgerId,
      name: expenseCategoryName,
      kind: CategoryKind.EXPENSE,
      sortOrder: 1
    }
  });
  const assetAccountSubject = await prisma.accountSubject.findUniqueOrThrow({
    where: {
      ledgerId_code: {
        ledgerId: backbone.ledgerId,
        code: '1010'
      }
    },
    select: {
      id: true
    }
  });
  const equityAccountSubject = await prisma.accountSubject.findUniqueOrThrow({
    where: {
      ledgerId_code: {
        ledgerId: backbone.ledgerId,
        code: '3100'
      }
    },
    select: {
      id: true
    }
  });

  return {
    userId: user.id,
    tenantId: backbone.tenantId,
    ledgerId: backbone.ledgerId,
    membershipId: backbone.membershipId,
    email,
    password: integrationPassword,
    fundingAccountId: fundingAccount.id,
    fundingAccountName,
    expenseCategoryId: expenseCategory.id,
    expenseCategoryName,
    assetAccountSubjectId: assetAccountSubject.id,
    equityAccountSubjectId: equityAccountSubject.id
  };
}

export async function cleanupIntegrationWorkspaceFixture(
  prisma: PrismaService,
  fixture: Pick<IntegrationWorkspaceFixture, 'tenantId' | 'ledgerId' | 'userId'>
): Promise<void> {
  await prisma.financialStatementSnapshot.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.carryForwardRecord.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.balanceSnapshotLine.deleteMany({
    where: {
      OR: [
        {
          openingSnapshot: {
            tenantId: fixture.tenantId
          }
        },
        {
          closingSnapshot: {
            tenantId: fixture.tenantId
          }
        }
      ]
    }
  });
  await prisma.closingSnapshot.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.openingBalanceSnapshot.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.journalEntry.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.collectedTransaction.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.importBatch.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.planItem.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.periodStatusHistory.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.accountingPeriod.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.recurringRule.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.ledgerTransactionType.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.accountSubject.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.category.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.account.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.ledger.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.tenantMembership.deleteMany({
    where: {
      tenantId: fixture.tenantId
    }
  });
  await prisma.tenant.deleteMany({
    where: {
      id: fixture.tenantId
    }
  });
  await prisma.authSession.deleteMany({
    where: {
      userId: fixture.userId
    }
  });
  await prisma.userSetting.deleteMany({
    where: {
      userId: fixture.userId
    }
  });
  await prisma.user.deleteMany({
    where: {
      id: fixture.userId
    }
  });
}

async function safeDisconnect(prisma: PrismaService) {
  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect failures during test cleanup.
  }
}

function restoreEnvVar(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function setRealApiEnv(databaseUrl: string) {
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
  process.env.SWAGGER_ENABLED = 'false';
  process.env.JWT_ACCESS_SECRET = 'prisma-integration-access-secret';
  process.env.JWT_REFRESH_SECRET = 'prisma-integration-refresh-secret';
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.REFRESH_TOKEN_TTL = '7d';
  process.env.DATABASE_URL = databaseUrl;
  process.env.DEMO_EMAIL = previous.DEMO_EMAIL ?? 'demo@example.com';
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
