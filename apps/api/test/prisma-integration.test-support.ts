import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import * as argon2 from 'argon2';
import { Test } from '@nestjs/testing';
import { AccountType, CategoryKind } from '@prisma/client';
import { configureApiApp } from '../src/bootstrap/configure-api-app';
import { EmailSenderPort } from '../src/common/application/ports/email-sender.port';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../src/common/utils/normalize-unique-key.util';
import { getApiEnv, resetApiEnvCache } from '../src/config/api-env';
import { listenOnSafeTestPort } from './http-test-port';
import { ensurePhase1BackboneForUser } from '../prisma/phase1-backbone';
import {
  getPrismaIntegrationMissingDatabaseMessage,
  getPrismaIntegrationUnreachableMessage,
  resolvePrismaIntegrationDatabaseEnv,
  shouldRunPrismaIntegration
} from './prisma-integration-env';

const integrationPassword = 'Integration1234!';
const integrationPasswordHashPromise = argon2.hash(integrationPassword);
const integrationPrimarySigningText = [
  'prisma',
  'integration',
  'access',
  'signing',
  'key'
].join('-');
const integrationSecondarySigningText = [
  'prisma',
  'integration',
  'refresh',
  'signing',
  'key'
].join('-');
const apiEnvNames = {
  primary: ['JWT', 'ACCESS', 'SECRET'].join('_'),
  secondary: ['JWT', 'REFRESH', 'SECRET'].join('_'),
  database: ['DATABASE', 'URL'].join('_')
} as const;

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
  sentEmails: Array<{
    to: string;
    subject: string;
    text: string;
    html?: string;
  }>;
  request(path: string, options?: ApiRequestOptions): Promise<ApiResponse>;
  login(
    email: string,
    password: string
  ): Promise<{
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
      'Run `npm run test:prisma` to execute this test against a disposable MySQL database.'
    );
    return null;
  }

  const resolvedDatabaseEnv = resolvePrismaIntegrationDatabaseEnv();
  if (!resolvedDatabaseEnv.databaseUrl) {
    t.skip(getPrismaIntegrationMissingDatabaseMessage());
    return null;
  }

  const restoreEnv = setRealApiEnv(resolvedDatabaseEnv.databaseUrl);
  const connectivityProbe = new PrismaService();

  try {
    await connectivityProbe.$connect();
  } catch {
    restoreEnv();
    t.skip(getPrismaIntegrationUnreachableMessage(resolvedDatabaseEnv));
    return null;
  } finally {
    await safeDisconnect(connectivityProbe);
  }

  try {
    const { AppModule } = await import('../src/app.module');
    const sentEmails: RealApiPrismaIntegrationContext['sentEmails'] = [];
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(EmailSenderPort)
      .useValue({
        send: async (message: {
          to: string;
          subject: string;
          text: string;
          html?: string;
        }) => {
          sentEmails.push(message);
        }
      })
      .compile();
    const app = moduleRef.createNestApplication();

    configureApiApp(app, getApiEnv());
    const port = await listenOnSafeTestPort(app);
    const baseUrl = `http://127.0.0.1:${port}/api`;
    const prisma = app.get(PrismaService);

    return {
      prisma,
      sentEmails,
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
      passwordHash,
      emailVerifiedAt: new Date()
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
      normalizedName: normalizeCaseInsensitiveText(fundingAccountName),
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
      normalizedName: normalizeCaseInsensitiveText(expenseCategoryName),
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
  await prisma.workspaceOperationalNote.deleteMany({
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
  await prisma.emailVerificationToken.deleteMany({
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
  process.env.SWAGGER_ENABLED = 'false';
  process.env[apiEnvNames.primary] = integrationPrimarySigningText;
  process.env[apiEnvNames.secondary] = integrationSecondarySigningText;
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.REFRESH_TOKEN_TTL = '7d';
  process.env.EMAIL_VERIFICATION_TTL = '30m';
  process.env[apiEnvNames.database] = databaseUrl;
  process.env.DEMO_EMAIL = previous.DEMO_EMAIL ?? 'demo@example.com';
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
