import assert from 'node:assert/strict';
import test from 'node:test';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type {
  CarryForwardView,
  CloseAccountingPeriodResponse,
  FinancialStatementPayload,
  FinancialStatementsView
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  FinancialStatementKind,
  LedgerTransactionFlowKind,
  RecurrenceFrequency,
  OpeningBalanceSourceKind,
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
import { AccountingPeriodsModule } from '../src/modules/accounting-periods/accounting-periods.module';
import { CarryForwardsModule } from '../src/modules/carry-forwards/carry-forwards.module';
import { DashboardModule } from '../src/modules/dashboard/dashboard.module';
import { FinancialStatementsModule } from '../src/modules/financial-statements/financial-statements.module';
import { ForecastModule } from '../src/modules/forecast/forecast.module';
import { HealthModule } from '../src/modules/health/health.module';
import { JournalEntriesModule } from '../src/modules/journal-entries/journal-entries.module';
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
  tenants: Array<{
    id: string;
    slug: string;
    name: string;
    status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'ARCHIVED';
    defaultLedgerId: string | null;
  }>;
  memberships: Array<{
    id: string;
    tenantId: string;
    userId: string;
    role: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
    status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
    joinedAt: Date;
  }>;
  ledgers: Array<{
    id: string;
    tenantId: string;
    name: string;
    baseCurrency: string;
    timezone: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
    createdAt: Date;
  }>;
  ledgerTransactionTypes: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    code: string;
    flowKind: LedgerTransactionFlowKind;
    isActive: boolean;
  }>;
  accountingPeriods: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    year: number;
    month: number;
    startDate: Date;
    endDate: Date;
    status: AccountingPeriodStatus;
    openedAt: Date;
    lockedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  periodStatusHistory: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    fromStatus: AccountingPeriodStatus | null;
    toStatus: AccountingPeriodStatus;
    reason: string | null;
    actorType: AuditActorType;
    actorMembershipId: string | null;
    changedAt: Date;
  }>;
  openingBalanceSnapshots: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    effectivePeriodId: string;
    sourceKind: OpeningBalanceSourceKind;
    createdAt: Date;
    createdByActorType: AuditActorType;
    createdByMembershipId: string | null;
  }>;
  closingSnapshots: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    lockedAt: Date;
    totalAssetAmount: number;
    totalLiabilityAmount: number;
    totalEquityAmount: number;
    periodPnLAmount: number;
    createdAt: Date;
  }>;
  balanceSnapshotLines: Array<{
    id: string;
    snapshotKind: 'OPENING' | 'CLOSING';
    openingSnapshotId: string | null;
    closingSnapshotId: string | null;
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: number;
  }>;
  financialStatementSnapshots: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    statementKind: FinancialStatementKind;
    currency: string;
    payload: FinancialStatementPayload;
    createdAt: Date;
    updatedAt: Date;
  }>;
  carryForwardRecords: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    fromPeriodId: string;
    toPeriodId: string;
    sourceClosingSnapshotId: string;
    createdJournalEntryId: string | null;
    createdAt: Date;
    createdByActorType: AuditActorType;
    createdByMembershipId: string | null;
  }>;
  accountSubjects: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
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
  collectedTransactions: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string | null;
    ledgerTransactionTypeId: string;
    fundingAccountId: string;
    categoryId: string | null;
    matchedPlanItemId: string | null;
    importBatchId: string | null;
    title: string;
    occurredOn: Date;
    amount: number;
    status: CollectedTransactionStatus;
    memo: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
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
  journalEntries: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    entryNumber: string;
    entryDate: Date;
    sourceKind:
      | 'COLLECTED_TRANSACTION'
      | 'PLAN_SETTLEMENT'
      | 'OPENING_BALANCE'
      | 'CARRY_FORWARD'
      | 'MANUAL_ADJUSTMENT';
    sourceCollectedTransactionId: string | null;
    status: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
    memo: string | null;
    createdByActorType: AuditActorType;
    createdByMembershipId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      lineNumber: number;
      accountSubjectId: string;
      fundingAccountId: string | null;
      debitAmount: number;
      creditAmount: number;
      description: string | null;
    }>;
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
        joinedAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'membership-2',
        tenantId: 'tenant-2',
        userId: 'user-2',
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date('2026-03-01T00:00:00.000Z')
      }
    ],
    ledgers: [
      {
        id: 'ledger-1',
        tenantId: 'tenant-1',
        name: '개인 장부',
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
        flowKind: LedgerTransactionFlowKind.INCOME,
        isActive: true
      },
      {
        id: 'ltt-1-expense',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: 'EXPENSE_BASIC',
        flowKind: LedgerTransactionFlowKind.EXPENSE,
        isActive: true
      },
      {
        id: 'ltt-1-transfer',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: 'TRANSFER_BASIC',
        flowKind: LedgerTransactionFlowKind.TRANSFER,
        isActive: true
      },
      {
        id: 'ltt-2-expense',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: 'EXPENSE_BASIC',
        flowKind: LedgerTransactionFlowKind.EXPENSE,
        isActive: true
      }
    ],
    accountingPeriods: [],
    periodStatusHistory: [],
    openingBalanceSnapshots: [],
    closingSnapshots: [],
    balanceSnapshotLines: [],
    financialStatementSnapshots: [],
    carryForwardRecords: [],
    accountSubjects: [
      {
        id: 'as-1-1010',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '1010',
        name: '현금및예금',
        isActive: true
      },
      {
        id: 'as-1-4100',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '4100',
        name: '운영수익',
        isActive: true
      },
      {
        id: 'as-1-5100',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '5100',
        name: '운영비용',
        isActive: true
      },
      {
        id: 'as-2-1010',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '1010',
        name: '현금및예금',
        isActive: true
      },
      {
        id: 'as-2-4100',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '4100',
        name: '운영수익',
        isActive: true
      },
      {
        id: 'as-2-5100',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '5100',
        name: '운영비용',
        isActive: true
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
    collectedTransactions: [
      {
        id: 'ctx-seed-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: null,
        ledgerTransactionTypeId: 'ltt-1-income',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1b',
        matchedPlanItemId: null,
        importBatchId: null,
        title: 'March salary',
        occurredOn: new Date('2026-03-25T00:00:00.000Z'),
        amount: 3_000_000,
        status: CollectedTransactionStatus.POSTED,
        memo: null,
        createdAt: new Date('2026-03-25T09:00:00.000Z'),
        updatedAt: new Date('2026-03-25T09:00:00.000Z')
      },
      {
        id: 'ctx-seed-2',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: null,
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: null,
        importBatchId: null,
        title: 'Fuel refill',
        occurredOn: new Date('2026-03-20T00:00:00.000Z'),
        amount: 84_000,
        status: CollectedTransactionStatus.POSTED,
        memo: 'Full tank',
        createdAt: new Date('2026-03-20T08:00:00.000Z'),
        updatedAt: new Date('2026-03-20T08:00:00.000Z')
      },
      {
        id: 'ctx-seed-3',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        periodId: null,
        ledgerTransactionTypeId: 'ltt-2-expense',
        fundingAccountId: 'acc-2',
        categoryId: 'cat-2',
        matchedPlanItemId: null,
        importBatchId: null,
        title: 'Other user expense',
        occurredOn: new Date('2026-03-18T00:00:00.000Z'),
        amount: 777_777,
        status: CollectedTransactionStatus.POSTED,
        memo: null,
        createdAt: new Date('2026-03-18T08:00:00.000Z'),
        updatedAt: new Date('2026-03-18T08:00:00.000Z')
      }
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
    journalEntries: [],
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

function createPrismaMock(state: RequestTestState): Record<string, unknown> {
  const sortTransactions = (
    items: RequestTestState['transactions']
  ): RequestTestState['transactions'] =>
    [...items].sort((left, right) => {
      if (left.businessDate.getTime() !== right.businessDate.getTime()) {
        return right.businessDate.getTime() - left.businessDate.getTime();
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });

  const sortCollectedTransactions = (
    items: RequestTestState['collectedTransactions']
  ): RequestTestState['collectedTransactions'] =>
    [...items].sort((left, right) => {
      if (left.occurredOn.getTime() !== right.occurredOn.getTime()) {
        return right.occurredOn.getTime() - left.occurredOn.getTime();
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

  const sortAccountingPeriods = (
    items: RequestTestState['accountingPeriods']
  ): RequestTestState['accountingPeriods'] =>
    [...items].sort((left, right) => {
      if (left.year !== right.year) {
        return right.year - left.year;
      }

      return right.month - left.month;
    });

  const findUser = (where: { email?: string; id?: string }) =>
    state.users.find((candidate) => {
      const { email, id } = where;
      return (
        (!email || candidate.email === email) && (!id || candidate.id === id)
      );
    });
  const findTenant = (tenantId: string) =>
    state.tenants.find((candidate) => candidate.id === tenantId) ?? null;
  const findLedger = (ledgerId: string) =>
    state.ledgers.find((candidate) => candidate.id === ledgerId) ?? null;
  const findAccountingPeriod = (periodId: string) =>
    state.accountingPeriods.find((candidate) => candidate.id === periodId) ??
    null;
  const findOpeningBalanceSnapshot = (periodId: string) =>
    state.openingBalanceSnapshots.find(
      (candidate) => candidate.effectivePeriodId === periodId
    ) ?? null;
  const findClosingSnapshot = (periodId: string) =>
    state.closingSnapshots.find(
      (candidate) => candidate.periodId === periodId
    ) ?? null;
  const findCarryForwardRecord = (fromPeriodId: string) =>
    state.carryForwardRecords.find(
      (candidate) => candidate.fromPeriodId === fromPeriodId
    ) ?? null;

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
  const resolveLedgerTransactionType = (ledgerTransactionTypeId: string) =>
    state.ledgerTransactionTypes.find(
      (candidate) => candidate.id === ledgerTransactionTypeId
    ) ?? null;
  const resolveAccountSubject = (accountSubjectId: string) =>
    state.accountSubjects.find(
      (candidate) => candidate.id === accountSubjectId
    ) ?? null;
  const resolveJournalEntryByCollectedTransaction = (
    collectedTransactionId: string
  ) =>
    state.journalEntries.find(
      (candidate) =>
        candidate.sourceCollectedTransactionId === collectedTransactionId
    ) ?? null;
  const projectJournalEntry = (
    candidate: RequestTestState['journalEntries'][number],
    include?: {
      sourceCollectedTransaction?: {
        select?: { id?: boolean; title?: boolean };
      };
      lines?: {
        include?: {
          accountSubject?: {
            select?: { code?: boolean; name?: boolean };
          };
          fundingAccount?: {
            select?: { name?: boolean };
          };
        };
      };
    }
  ) => {
    const sourceCollectedTransaction = candidate.sourceCollectedTransactionId
      ? (state.collectedTransactions.find(
          (item) => item.id === candidate.sourceCollectedTransactionId
        ) ?? null)
      : null;

    return {
      ...candidate,
      ...(include?.sourceCollectedTransaction
        ? {
            sourceCollectedTransaction: sourceCollectedTransaction
              ? {
                  ...(include.sourceCollectedTransaction.select?.id
                    ? { id: sourceCollectedTransaction.id }
                    : {}),
                  ...(include.sourceCollectedTransaction.select?.title
                    ? { title: sourceCollectedTransaction.title }
                    : {})
                }
              : null
          }
        : {}),
      ...(include?.lines
        ? {
            lines: candidate.lines.map((line) => {
              const accountSubject = resolveAccountSubject(
                line.accountSubjectId
              );
              const fundingAccount = line.fundingAccountId
                ? resolveAccount(line.fundingAccountId)
                : null;

              return {
                ...line,
                ...(include.lines?.include?.accountSubject
                  ? {
                      accountSubject: {
                        ...(include.lines.include.accountSubject.select?.code
                          ? { code: accountSubject?.code ?? '' }
                          : {}),
                        ...(include.lines.include.accountSubject.select?.name
                          ? { name: accountSubject?.name ?? '' }
                          : {})
                      }
                    }
                  : {}),
                ...(include.lines?.include?.fundingAccount
                  ? {
                      fundingAccount: fundingAccount
                        ? {
                            ...(include.lines.include.fundingAccount.select
                              ?.name
                              ? { name: fundingAccount.name }
                              : {})
                          }
                        : null
                    }
                  : {})
              };
            })
          }
        : {})
    };
  };

  return {
    $queryRaw: async () => {
      if (!state.databaseReady) {
        throw new Error('Database unavailable');
      }

      return [{ ready: 1 }];
    },
    $transaction: async <T>(
      callback: (tx: Record<string, unknown>) => Promise<T>
    ) => callback(createPrismaMock(state)),
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
    tenantMembership: {
      findMany: async (args: {
        where?: {
          userId?: string;
          status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
        };
        select?: {
          id?: boolean;
          role?: boolean;
          status?: boolean;
          tenantId?: boolean;
          joinedAt?: boolean;
        };
      }) => {
        const items = state.memberships.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesStatus =
            !args.where?.status || candidate.status === args.where.status;
          return matchesUser && matchesStatus;
        });

        if (!args.select) {
          return items;
        }

        return items.map((candidate) => ({
          ...(args.select?.id ? { id: candidate.id } : {}),
          ...(args.select?.role ? { role: candidate.role } : {}),
          ...(args.select?.status ? { status: candidate.status } : {}),
          ...(args.select?.tenantId ? { tenantId: candidate.tenantId } : {}),
          ...(args.select?.joinedAt ? { joinedAt: candidate.joinedAt } : {})
        }));
      }
    },
    tenant: {
      findUnique: async (args: {
        where: { id: string };
        select?: {
          id?: boolean;
          slug?: boolean;
          name?: boolean;
          status?: boolean;
          defaultLedgerId?: boolean;
        };
      }) => {
        const tenant = findTenant(args.where.id);
        if (!tenant) {
          return null;
        }

        if (!args.select) {
          return tenant;
        }

        return {
          ...(args.select.id ? { id: tenant.id } : {}),
          ...(args.select.slug ? { slug: tenant.slug } : {}),
          ...(args.select.name ? { name: tenant.name } : {}),
          ...(args.select.status ? { status: tenant.status } : {}),
          ...(args.select.defaultLedgerId
            ? { defaultLedgerId: tenant.defaultLedgerId }
            : {})
        };
      }
    },
    ledger: {
      findUnique: async (args: {
        where: { id: string };
        select?: {
          id?: boolean;
          name?: boolean;
          baseCurrency?: boolean;
          timezone?: boolean;
          status?: boolean;
        };
      }) => {
        const ledger = findLedger(args.where.id);
        if (!ledger) {
          return null;
        }

        if (!args.select) {
          return ledger;
        }

        return {
          ...(args.select.id ? { id: ledger.id } : {}),
          ...(args.select.name ? { name: ledger.name } : {}),
          ...(args.select.baseCurrency
            ? { baseCurrency: ledger.baseCurrency }
            : {}),
          ...(args.select.timezone ? { timezone: ledger.timezone } : {}),
          ...(args.select.status ? { status: ledger.status } : {})
        };
      },
      findFirst: async (args: {
        where?: { tenantId?: string };
        select?: {
          id?: boolean;
          name?: boolean;
          baseCurrency?: boolean;
          timezone?: boolean;
          status?: boolean;
        };
      }) => {
        const ledger =
          state.ledgers.find(
            (candidate) =>
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId
          ) ?? null;

        if (!ledger) {
          return null;
        }

        if (!args.select) {
          return ledger;
        }

        return {
          ...(args.select.id ? { id: ledger.id } : {}),
          ...(args.select.name ? { name: ledger.name } : {}),
          ...(args.select.baseCurrency
            ? { baseCurrency: ledger.baseCurrency }
            : {}),
          ...(args.select.timezone ? { timezone: ledger.timezone } : {}),
          ...(args.select.status ? { status: ledger.status } : {})
        };
      }
    },
    accountingPeriod: {
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          year?: number;
          month?: number;
          status?: AccountingPeriodStatus | { in?: AccountingPeriodStatus[] };
          OR?: Array<{
            year?: number | { lt?: number };
            month?: number | { lt?: number };
          }>;
        };
        select?: {
          id?: boolean;
        };
        include?: {
          ledger?: {
            select?: { baseCurrency?: boolean };
          };
          openingBalanceSnapshot?: {
            select?: { sourceKind?: boolean };
          };
          statusHistory?: {
            orderBy?: { changedAt?: 'asc' | 'desc' };
            select?: {
              id?: boolean;
              fromStatus?: boolean;
              toStatus?: boolean;
              reason?: boolean;
              actorType?: boolean;
              actorMembershipId?: boolean;
              changedAt?: boolean;
            };
          };
        };
        orderBy?: Array<{ year?: 'asc' | 'desc'; month?: 'asc' | 'desc' }>;
      }) => {
        let items = state.accountingPeriods.filter((candidate) => {
          const matchesId = !args.where?.id || candidate.id === args.where.id;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesYear =
            args.where?.year === undefined ||
            candidate.year === args.where.year;
          const matchesMonth =
            args.where?.month === undefined ||
            candidate.month === args.where.month;
          const matchesStatus =
            args.where?.status === undefined
              ? true
              : typeof args.where.status === 'string'
                ? candidate.status === args.where.status
                : !args.where.status.in ||
                  args.where.status.in.includes(candidate.status);
          const matchesOr =
            !args.where?.OR ||
            args.where.OR.some((clause) => {
              const matchesClauseYear =
                clause.year === undefined
                  ? true
                  : typeof clause.year === 'number'
                    ? candidate.year === clause.year
                    : clause.year.lt === undefined
                      ? true
                      : candidate.year < clause.year.lt;
              const matchesClauseMonth =
                clause.month === undefined
                  ? true
                  : typeof clause.month === 'number'
                    ? candidate.month === clause.month
                    : clause.month.lt === undefined
                      ? true
                      : candidate.month < clause.month.lt;

              return matchesClauseYear && matchesClauseMonth;
            });

          return (
            matchesId &&
            matchesTenant &&
            matchesLedger &&
            matchesYear &&
            matchesMonth &&
            matchesStatus &&
            matchesOr
          );
        });

        items = sortAccountingPeriods(items);

        const candidate = items[0];
        if (!candidate) {
          return null;
        }

        if (args.select) {
          return {
            ...(args.select.id ? { id: candidate.id } : {})
          };
        }

        const ledger = args.include?.ledger
          ? findLedger(candidate.ledgerId)
          : null;
        const openingBalanceSnapshot = args.include?.openingBalanceSnapshot
          ? (state.openingBalanceSnapshots.find(
              (snapshot) => snapshot.effectivePeriodId === candidate.id
            ) ?? null)
          : undefined;
        const statusHistory = args.include?.statusHistory
          ? [...state.periodStatusHistory]
              .filter((history) => history.periodId === candidate.id)
              .sort(
                (left, right) =>
                  right.changedAt.getTime() - left.changedAt.getTime()
              )
              .map((history) => ({
                ...(args.include?.statusHistory?.select?.id
                  ? { id: history.id }
                  : {}),
                ...(args.include?.statusHistory?.select?.fromStatus
                  ? { fromStatus: history.fromStatus }
                  : {}),
                ...(args.include?.statusHistory?.select?.toStatus
                  ? { toStatus: history.toStatus }
                  : {}),
                ...(args.include?.statusHistory?.select?.reason
                  ? { reason: history.reason }
                  : {}),
                ...(args.include?.statusHistory?.select?.actorType
                  ? { actorType: history.actorType }
                  : {}),
                ...(args.include?.statusHistory?.select?.actorMembershipId
                  ? { actorMembershipId: history.actorMembershipId }
                  : {}),
                ...(args.include?.statusHistory?.select?.changedAt
                  ? { changedAt: history.changedAt }
                  : {})
              }))
          : undefined;

        return {
          ...candidate,
          ...(args.include?.ledger
            ? {
                ledger: ledger
                  ? {
                      ...(args.include.ledger.select?.baseCurrency
                        ? { baseCurrency: ledger.baseCurrency }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include?.openingBalanceSnapshot
            ? {
                openingBalanceSnapshot: openingBalanceSnapshot
                  ? {
                      ...(args.include?.openingBalanceSnapshot?.select
                        ?.sourceKind
                        ? { sourceKind: openingBalanceSnapshot.sourceKind }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include?.statusHistory ? { statusHistory } : {})
        };
      },
      findMany: async (args: {
        where?: { tenantId?: string; ledgerId?: string };
        include?: {
          openingBalanceSnapshot?: {
            select?: { sourceKind?: boolean };
          };
          statusHistory?: {
            orderBy?: { changedAt?: 'asc' | 'desc' };
            select?: {
              id?: boolean;
              fromStatus?: boolean;
              toStatus?: boolean;
              reason?: boolean;
              actorType?: boolean;
              actorMembershipId?: boolean;
              changedAt?: boolean;
            };
          };
        };
        orderBy?: Array<{ year?: 'asc' | 'desc'; month?: 'asc' | 'desc' }>;
      }) => {
        let items = state.accountingPeriods.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesTenant && matchesLedger;
        });

        items = sortAccountingPeriods(items);

        return items.map((candidate) => {
          const openingBalanceSnapshot = args.include?.openingBalanceSnapshot
            ? (state.openingBalanceSnapshots.find(
                (snapshot) => snapshot.effectivePeriodId === candidate.id
              ) ?? null)
            : undefined;
          const statusHistory = args.include?.statusHistory
            ? [...state.periodStatusHistory]
                .filter((history) => history.periodId === candidate.id)
                .sort(
                  (left, right) =>
                    right.changedAt.getTime() - left.changedAt.getTime()
                )
                .map((history) => ({
                  ...(args.include?.statusHistory?.select?.id
                    ? { id: history.id }
                    : {}),
                  ...(args.include?.statusHistory?.select?.fromStatus
                    ? { fromStatus: history.fromStatus }
                    : {}),
                  ...(args.include?.statusHistory?.select?.toStatus
                    ? { toStatus: history.toStatus }
                    : {}),
                  ...(args.include?.statusHistory?.select?.reason
                    ? { reason: history.reason }
                    : {}),
                  ...(args.include?.statusHistory?.select?.actorType
                    ? { actorType: history.actorType }
                    : {}),
                  ...(args.include?.statusHistory?.select?.actorMembershipId
                    ? { actorMembershipId: history.actorMembershipId }
                    : {}),
                  ...(args.include?.statusHistory?.select?.changedAt
                    ? { changedAt: history.changedAt }
                    : {})
                }))
            : undefined;

          return {
            ...candidate,
            ...(args.include?.openingBalanceSnapshot
              ? {
                  openingBalanceSnapshot: openingBalanceSnapshot
                    ? {
                        ...(args.include?.openingBalanceSnapshot?.select
                          ?.sourceKind
                          ? { sourceKind: openingBalanceSnapshot.sourceKind }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.include?.statusHistory ? { statusHistory } : {})
          };
        });
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          year: number;
          month: number;
          startDate: Date;
          endDate: Date;
          status: AccountingPeriodStatus;
        };
      }) => {
        const created = {
          id: `period-${state.accountingPeriods.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          year: args.data.year,
          month: args.data.month,
          startDate: args.data.startDate,
          endDate: args.data.endDate,
          status: args.data.status,
          openedAt: new Date(),
          lockedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        state.accountingPeriods.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          status?: AccountingPeriodStatus;
          lockedAt?: Date | null;
        };
      }) => {
        const candidate = state.accountingPeriods.find(
          (item) => item.id === args.where.id
        );

        if (!candidate) {
          throw new Error('Accounting period not found');
        }

        if (args.data.status !== undefined) {
          candidate.status = args.data.status;
        }

        if (args.data.lockedAt !== undefined) {
          candidate.lockedAt = args.data.lockedAt;
        }

        candidate.updatedAt = new Date();
        return candidate;
      }
    },
    periodStatusHistory: {
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          fromStatus: AccountingPeriodStatus | null;
          toStatus: AccountingPeriodStatus;
          reason: string | null;
          actorType: AuditActorType;
          actorMembershipId: string | null;
        };
      }) => {
        const created = {
          id: `period-history-${state.periodStatusHistory.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          fromStatus: args.data.fromStatus,
          toStatus: args.data.toStatus,
          reason: args.data.reason,
          actorType: args.data.actorType,
          actorMembershipId: args.data.actorMembershipId,
          changedAt: new Date()
        };

        state.periodStatusHistory.push(created);
        return created;
      }
    },
    openingBalanceSnapshot: {
      findUnique: async (args: {
        where: {
          effectivePeriodId: string;
        };
        include?: {
          lines?: {
            include?: {
              accountSubject?: {
                select?: {
                  code?: boolean;
                  name?: boolean;
                };
              };
              fundingAccount?: {
                select?: {
                  name?: boolean;
                };
              };
            };
          };
        };
      }) => {
        const snapshot = findOpeningBalanceSnapshot(
          args.where.effectivePeriodId
        );

        if (!snapshot) {
          return null;
        }

        const lines = args.include?.lines
          ? state.balanceSnapshotLines
              .filter((line) => line.openingSnapshotId === snapshot.id)
              .map((line) => {
                const accountSubject = resolveAccountSubject(
                  line.accountSubjectId
                );
                const fundingAccount = line.fundingAccountId
                  ? resolveAccount(line.fundingAccountId)
                  : null;

                return {
                  ...line,
                  accountSubject: {
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.code
                      ? { code: accountSubject?.code ?? '' }
                      : {}),
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.name
                      ? { name: accountSubject?.name ?? '' }
                      : {})
                  },
                  fundingAccount: fundingAccount
                    ? {
                        ...(args.include?.lines?.include?.fundingAccount?.select
                          ?.name
                          ? { name: fundingAccount.name }
                          : {})
                      }
                    : null
                };
              })
          : undefined;

        return {
          ...snapshot,
          ...(args.include?.lines ? { lines } : {})
        };
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          effectivePeriodId: string;
          sourceKind: OpeningBalanceSourceKind;
          createdByActorType: AuditActorType;
          createdByMembershipId: string | null;
        };
        select?: {
          sourceKind?: boolean;
        };
      }) => {
        const period = findAccountingPeriod(args.data.effectivePeriodId);
        if (!period) {
          throw new Error('Period not found');
        }

        const created = {
          id: `opening-snapshot-${state.openingBalanceSnapshots.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          effectivePeriodId: args.data.effectivePeriodId,
          sourceKind: args.data.sourceKind,
          createdAt: new Date(),
          createdByActorType: args.data.createdByActorType,
          createdByMembershipId: args.data.createdByMembershipId
        };

        state.openingBalanceSnapshots.push(created);

        if (args.select?.sourceKind) {
          return {
            sourceKind: created.sourceKind
          };
        }

        return created;
      }
    },
    closingSnapshot: {
      findUnique: async (args: {
        where: {
          periodId: string;
        };
        select?: {
          id?: boolean;
        };
        include?: {
          lines?: {
            include?: {
              accountSubject?: {
                select?: {
                  code?: boolean;
                  name?: boolean;
                };
              };
              fundingAccount?: {
                select?: {
                  name?: boolean;
                };
              };
            };
          };
        };
      }) => {
        const snapshot = findClosingSnapshot(args.where.periodId);

        if (!snapshot) {
          return null;
        }

        if (args.select?.id) {
          return { id: snapshot.id };
        }

        const lines = args.include?.lines
          ? state.balanceSnapshotLines
              .filter((line) => line.closingSnapshotId === snapshot.id)
              .map((line) => {
                const accountSubject = resolveAccountSubject(
                  line.accountSubjectId
                );
                const fundingAccount = line.fundingAccountId
                  ? resolveAccount(line.fundingAccountId)
                  : null;

                return {
                  ...line,
                  accountSubject: {
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.code
                      ? { code: accountSubject?.code ?? '' }
                      : {}),
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.name
                      ? { name: accountSubject?.name ?? '' }
                      : {})
                  },
                  fundingAccount: fundingAccount
                    ? {
                        ...(args.include?.lines?.include?.fundingAccount?.select
                          ?.name
                          ? { name: fundingAccount.name }
                          : {})
                      }
                    : null
                };
              })
          : undefined;

        return {
          ...snapshot,
          ...(args.include?.lines ? { lines } : {})
        };
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          lockedAt: Date;
          totalAssetAmount: number;
          totalLiabilityAmount: number;
          totalEquityAmount: number;
          periodPnLAmount: number;
        };
      }) => {
        const created = {
          id: `closing-snapshot-${state.closingSnapshots.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          lockedAt: new Date(String(args.data.lockedAt)),
          totalAssetAmount: args.data.totalAssetAmount,
          totalLiabilityAmount: args.data.totalLiabilityAmount,
          totalEquityAmount: args.data.totalEquityAmount,
          periodPnLAmount: args.data.periodPnLAmount,
          createdAt: new Date()
        };

        state.closingSnapshots.push(created);
        return created;
      }
    },
    balanceSnapshotLine: {
      findMany: async (args: {
        where?: {
          openingSnapshotId?: string;
          closingSnapshotId?: string;
        };
        include?: {
          accountSubject?: {
            select?: {
              code?: boolean;
              name?: boolean;
            };
          };
          fundingAccount?: {
            select?: {
              name?: boolean;
            };
          };
        };
      }) => {
        const items = state.balanceSnapshotLines.filter((line) => {
          const matchesOpeningSnapshot =
            !args.where?.openingSnapshotId ||
            line.openingSnapshotId === args.where.openingSnapshotId;
          const matchesClosingSnapshot =
            !args.where?.closingSnapshotId ||
            line.closingSnapshotId === args.where.closingSnapshotId;

          return matchesOpeningSnapshot && matchesClosingSnapshot;
        });

        return items.map((line) => {
          const accountSubject = resolveAccountSubject(line.accountSubjectId);
          const fundingAccount = line.fundingAccountId
            ? resolveAccount(line.fundingAccountId)
            : null;

          return {
            ...line,
            ...(args.include?.accountSubject
              ? {
                  accountSubject: {
                    ...(args.include.accountSubject.select?.code
                      ? { code: accountSubject?.code ?? '' }
                      : {}),
                    ...(args.include.accountSubject.select?.name
                      ? { name: accountSubject?.name ?? '' }
                      : {})
                  }
                }
              : {}),
            ...(args.include?.fundingAccount
              ? {
                  fundingAccount: fundingAccount
                    ? {
                        ...(args.include.fundingAccount.select?.name
                          ? { name: fundingAccount.name }
                          : {})
                      }
                    : null
                }
              : {})
          };
        });
      },
      createMany: async (args: {
        data: Array<{
          snapshotKind: 'OPENING' | 'CLOSING';
          openingSnapshotId?: string | null;
          closingSnapshotId?: string | null;
          accountSubjectId: string;
          fundingAccountId?: string | null;
          balanceAmount: number;
        }>;
      }) => {
        for (const line of args.data) {
          state.balanceSnapshotLines.push({
            id: `balance-snapshot-line-${state.balanceSnapshotLines.length + 1}`,
            snapshotKind: line.snapshotKind,
            openingSnapshotId: line.openingSnapshotId ?? null,
            closingSnapshotId: line.closingSnapshotId ?? null,
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: line.fundingAccountId ?? null,
            balanceAmount: line.balanceAmount
          });
        }

        return {
          count: args.data.length
        };
      }
    },
    financialStatementSnapshot: {
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
        };
        include?: {
          period?: {
            select?: {
              year?: boolean;
              month?: boolean;
            };
          };
        };
      }) => {
        const items = state.financialStatementSnapshots.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPeriod =
            !args.where?.periodId || candidate.periodId === args.where.periodId;

          return matchesTenant && matchesLedger && matchesPeriod;
        });

        return items.map((candidate) => {
          const period = findAccountingPeriod(candidate.periodId);

          return {
            ...candidate,
            ...(args.include?.period
              ? {
                  period: period
                    ? {
                        ...(args.include.period.select?.year
                          ? { year: period.year }
                          : {}),
                        ...(args.include.period.select?.month
                          ? { month: period.month }
                          : {})
                      }
                    : null
                }
              : {})
          };
        });
      },
      upsert: async (args: {
        where: {
          periodId_statementKind: {
            periodId: string;
            statementKind: FinancialStatementKind;
          };
        };
        update: {
          currency: string;
          payload: FinancialStatementPayload;
        };
        create: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          statementKind: FinancialStatementKind;
          currency: string;
          payload: FinancialStatementPayload;
        };
      }) => {
        const existing = state.financialStatementSnapshots.find(
          (candidate) =>
            candidate.periodId === args.where.periodId_statementKind.periodId &&
            candidate.statementKind ===
              args.where.periodId_statementKind.statementKind
        );

        if (existing) {
          existing.currency = args.update.currency;
          existing.payload = args.update.payload;
          existing.updatedAt = new Date();
          return existing;
        }

        const created = {
          id: `financial-statement-snapshot-${state.financialStatementSnapshots.length + 1}`,
          tenantId: args.create.tenantId,
          ledgerId: args.create.ledgerId,
          periodId: args.create.periodId,
          statementKind: args.create.statementKind,
          currency: args.create.currency,
          payload: args.create.payload,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        state.financialStatementSnapshots.push(created);
        return created;
      }
    },
    carryForwardRecord: {
      findFirst: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          fromPeriodId?: string;
        };
      }) => {
        const fromPeriodMatch = args.where?.fromPeriodId
          ? findCarryForwardRecord(args.where.fromPeriodId)
          : null;

        if (
          fromPeriodMatch &&
          (!args.where?.tenantId ||
            fromPeriodMatch.tenantId === args.where.tenantId) &&
          (!args.where?.ledgerId ||
            fromPeriodMatch.ledgerId === args.where.ledgerId)
        ) {
          return fromPeriodMatch;
        }

        return (
          state.carryForwardRecords.find((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesFromPeriod =
              !args.where?.fromPeriodId ||
              candidate.fromPeriodId === args.where.fromPeriodId;

            return matchesTenant && matchesLedger && matchesFromPeriod;
          }) ?? null
        );
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          fromPeriodId: string;
          toPeriodId: string;
          sourceClosingSnapshotId: string;
          createdJournalEntryId: string | null;
          createdByActorType: AuditActorType;
          createdByMembershipId: string | null;
        };
      }) => {
        const created = {
          id: `carry-forward-record-${state.carryForwardRecords.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          fromPeriodId: args.data.fromPeriodId,
          toPeriodId: args.data.toPeriodId,
          sourceClosingSnapshotId: args.data.sourceClosingSnapshotId,
          createdJournalEntryId: args.data.createdJournalEntryId,
          createdAt: new Date(),
          createdByActorType: args.data.createdByActorType,
          createdByMembershipId: args.data.createdByMembershipId
        };

        state.carryForwardRecords.push(created);
        return created;
      }
    },
    accountSubject: {
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          code?: { in?: string[] };
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
          code?: boolean;
        };
      }) => {
        const items = state.accountSubjects.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesCode =
            !args.where?.code?.in ||
            args.where.code.in.includes(candidate.code);
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;

          return matchesTenant && matchesLedger && matchesCode && matchesActive;
        });

        if (!args.select) {
          return items;
        }

        return items.map((candidate) => ({
          ...(args.select?.id ? { id: candidate.id } : {}),
          ...(args.select?.code ? { code: candidate.code } : {})
        }));
      }
    },
    ledgerTransactionType: {
      findFirst: async (args: {
        where: {
          tenantId?: string;
          ledgerId?: string;
          code?: string;
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
        };
      }) => {
        const item =
          state.ledgerTransactionTypes.find((candidate) => {
            const matchesTenant =
              !args.where.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesCode =
              !args.where.code || candidate.code === args.where.code;
            const matchesActive =
              args.where.isActive === undefined ||
              candidate.isActive === args.where.isActive;

            return (
              matchesTenant && matchesLedger && matchesCode && matchesActive
            );
          }) ?? null;

        if (!item) {
          return null;
        }

        if (args.select?.id) {
          return {
            id: item.id
          };
        }

        return item;
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
    collectedTransaction: {
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        include?: {
          period?: {
            select?: {
              id?: boolean;
              year?: boolean;
              month?: boolean;
              status?: boolean;
            };
          };
          fundingAccount?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
          category?: {
            select?: {
              name?: boolean;
            };
          };
          ledgerTransactionType?: {
            select?: {
              postingPolicyKey?: boolean;
            };
          };
          postedJournalEntry?: {
            select?: {
              id?: boolean;
            };
          };
        };
      }) => {
        const candidate =
          state.collectedTransactions.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesTenant =
              !args.where?.tenantId || item.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;

            return matchesId && matchesTenant && matchesLedger;
          }) ?? null;

        if (!candidate) {
          return null;
        }

        const period = candidate.periodId
          ? findAccountingPeriod(candidate.periodId)
          : null;
        const fundingAccount = resolveAccount(candidate.fundingAccountId);
        const category = candidate.categoryId
          ? resolveCategory(candidate.categoryId)
          : null;
        const _ledgerTransactionType = resolveLedgerTransactionType(
          candidate.ledgerTransactionTypeId
        );
        const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
          candidate.id
        );

        if (!args.include) {
          return candidate;
        }

        return {
          ...candidate,
          ...(args.include.period
            ? {
                period: period
                  ? {
                      ...(args.include.period.select?.id
                        ? { id: period.id }
                        : {}),
                      ...(args.include.period.select?.year
                        ? { year: period.year }
                        : {}),
                      ...(args.include.period.select?.month
                        ? { month: period.month }
                        : {}),
                      ...(args.include.period.select?.status
                        ? { status: period.status }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include.fundingAccount
            ? {
                fundingAccount: {
                  ...(args.include.fundingAccount.select?.id
                    ? { id: fundingAccount?.id ?? '' }
                    : {}),
                  ...(args.include.fundingAccount.select?.name
                    ? { name: fundingAccount?.name ?? '' }
                    : {})
                }
              }
            : {}),
          ...(args.include.category
            ? {
                category: category
                  ? {
                      ...(args.include.category.select?.name
                        ? { name: category.name }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include.ledgerTransactionType
            ? {
                ledgerTransactionType: {
                  ...(args.include.ledgerTransactionType.select
                    ?.postingPolicyKey
                    ? {
                        postingPolicyKey:
                          candidate.ledgerTransactionTypeId === 'ltt-1-income'
                            ? 'INCOME_BASIC'
                            : candidate.ledgerTransactionTypeId ===
                                'ltt-1-transfer'
                              ? 'TRANSFER_BASIC'
                              : 'EXPENSE_BASIC'
                      }
                    : {})
                }
              }
            : {}),
          ...(args.include.postedJournalEntry
            ? {
                postedJournalEntry: postedJournalEntry
                  ? {
                      ...(args.include.postedJournalEntry.select?.id
                        ? { id: postedJournalEntry.id }
                        : {})
                    }
                  : null
              }
            : {})
        };
      },
      findMany: async (args: {
        where?: { tenantId?: string; ledgerId?: string };
        select?: {
          id?: boolean;
          occurredOn?: boolean;
          title?: boolean;
          amount?: boolean;
          status?: boolean;
          importBatchId?: boolean;
          matchedPlanItemId?: boolean;
          postedJournalEntry?: {
            select?: {
              id?: boolean;
              entryNumber?: boolean;
            };
          };
          fundingAccount?: {
            select?: { name?: boolean };
          };
          category?: {
            select?: { name?: boolean };
          };
          ledgerTransactionType?: {
            select?: { flowKind?: boolean };
          };
        };
        orderBy?: Array<{
          occurredOn?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.collectedTransactions.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesTenant && matchesLedger;
        });

        items = sortCollectedTransactions(items);

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) => {
          const fundingAccount = resolveAccount(candidate.fundingAccountId);
          const category = candidate.categoryId
            ? resolveCategory(candidate.categoryId)
            : null;
          const ledgerTransactionType = resolveLedgerTransactionType(
            candidate.ledgerTransactionTypeId
          );
          const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
            candidate.id
          );

          if (!args.select) {
            return candidate;
          }

          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.occurredOn
              ? { occurredOn: candidate.occurredOn }
              : {}),
            ...(args.select.title ? { title: candidate.title } : {}),
            ...(args.select.amount ? { amount: candidate.amount } : {}),
            ...(args.select.status ? { status: candidate.status } : {}),
            ...(args.select.importBatchId
              ? { importBatchId: candidate.importBatchId }
              : {}),
            ...(args.select.matchedPlanItemId
              ? { matchedPlanItemId: candidate.matchedPlanItemId }
              : {}),
            ...(args.select.postedJournalEntry
              ? {
                  postedJournalEntry: postedJournalEntry
                    ? {
                        ...(args.select.postedJournalEntry.select?.id
                          ? { id: postedJournalEntry.id }
                          : {}),
                        ...(args.select.postedJournalEntry.select?.entryNumber
                          ? { entryNumber: postedJournalEntry.entryNumber }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.select.fundingAccount
              ? {
                  fundingAccount: {
                    ...(args.select.fundingAccount.select?.name
                      ? { name: fundingAccount?.name ?? '' }
                      : {})
                  }
                }
              : {}),
            ...(args.select.category
              ? {
                  category: category
                    ? {
                        ...(args.select.category.select?.name
                          ? { name: category.name }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.select.ledgerTransactionType
              ? {
                  ledgerTransactionType: {
                    ...(args.select.ledgerTransactionType.select?.flowKind
                      ? {
                          flowKind:
                            ledgerTransactionType?.flowKind ??
                            LedgerTransactionFlowKind.EXPENSE
                        }
                      : {})
                  }
                }
              : {})
          };
        });
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId?: string;
          ledgerTransactionTypeId: string;
          fundingAccountId: string;
          categoryId?: string;
          title: string;
          occurredOn: Date;
          amount: number;
          status: CollectedTransactionStatus;
          memo?: string;
        };
        select?: {
          id?: boolean;
          occurredOn?: boolean;
          title?: boolean;
          amount?: boolean;
          status?: boolean;
          importBatchId?: boolean;
          matchedPlanItemId?: boolean;
          postedJournalEntry?: {
            select?: {
              id?: boolean;
              entryNumber?: boolean;
            };
          };
          fundingAccount?: {
            select?: { name?: boolean };
          };
          category?: {
            select?: { name?: boolean };
          };
          ledgerTransactionType?: {
            select?: { flowKind?: boolean };
          };
        };
      }) => {
        const fundingAccount = resolveAccount(args.data.fundingAccountId);
        const category = args.data.categoryId
          ? resolveCategory(args.data.categoryId)
          : null;
        const ledgerTransactionType = resolveLedgerTransactionType(
          args.data.ledgerTransactionTypeId
        );
        const created = {
          id: `ctx-${state.collectedTransactions.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId ?? null,
          ledgerTransactionTypeId: args.data.ledgerTransactionTypeId,
          fundingAccountId: args.data.fundingAccountId,
          categoryId: args.data.categoryId ?? null,
          matchedPlanItemId: null,
          importBatchId: null,
          title: args.data.title,
          occurredOn: new Date(String(args.data.occurredOn)),
          amount: Number(args.data.amount),
          status: args.data.status,
          memo: args.data.memo ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.collectedTransactions.push(created);

        if (!args.select) {
          return created;
        }

        const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
          created.id
        );

        return {
          ...(args.select.id ? { id: created.id } : {}),
          ...(args.select.occurredOn ? { occurredOn: created.occurredOn } : {}),
          ...(args.select.title ? { title: created.title } : {}),
          ...(args.select.amount ? { amount: created.amount } : {}),
          ...(args.select.status ? { status: created.status } : {}),
          ...(args.select.importBatchId
            ? { importBatchId: created.importBatchId }
            : {}),
          ...(args.select.matchedPlanItemId
            ? { matchedPlanItemId: created.matchedPlanItemId }
            : {}),
          ...(args.select.postedJournalEntry
            ? {
                postedJournalEntry: postedJournalEntry
                  ? {
                      ...(args.select.postedJournalEntry.select?.id
                        ? { id: postedJournalEntry.id }
                        : {}),
                      ...(args.select.postedJournalEntry.select?.entryNumber
                        ? { entryNumber: postedJournalEntry.entryNumber }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.fundingAccount
            ? {
                fundingAccount: {
                  ...(args.select.fundingAccount.select?.name
                    ? { name: fundingAccount?.name ?? '' }
                    : {})
                }
              }
            : {}),
          ...(args.select.category
            ? {
                category: category
                  ? {
                      ...(args.select.category.select?.name
                        ? { name: category.name }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.ledgerTransactionType
            ? {
                ledgerTransactionType: {
                  ...(args.select.ledgerTransactionType.select?.flowKind
                    ? {
                        flowKind:
                          ledgerTransactionType?.flowKind ??
                          LedgerTransactionFlowKind.EXPENSE
                      }
                    : {})
                }
              }
            : {})
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          status?: CollectedTransactionStatus;
        };
      }) => {
        const candidate = state.collectedTransactions.find(
          (item) => item.id === args.where.id
        );

        if (!candidate) {
          throw new Error('Collected transaction not found');
        }

        if (args.data.status) {
          candidate.status = args.data.status;
        }
        candidate.updatedAt = new Date();

        return candidate;
      }
    },
    journalEntry: {
      count: async (args: {
        where?: { tenantId?: string; ledgerId?: string; periodId?: string };
      }) => {
        return state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPeriod =
            !args.where?.periodId || candidate.periodId === args.where.periodId;

          return matchesTenant && matchesLedger && matchesPeriod;
        }).length;
      },
      findMany: async (args: {
        where?: { tenantId?: string; ledgerId?: string };
        include?: {
          sourceCollectedTransaction?: {
            select?: { id?: boolean; title?: boolean };
          };
          lines?: {
            include?: {
              accountSubject?: {
                select?: { code?: boolean; name?: boolean };
              };
              fundingAccount?: {
                select?: { name?: boolean };
              };
            };
            orderBy?: { lineNumber?: 'asc' | 'desc' };
          };
        };
        orderBy?: Array<{
          entryDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesTenant && matchesLedger;
        });

        items = [...items].sort((left, right) => {
          if (left.entryDate.getTime() !== right.entryDate.getTime()) {
            return right.entryDate.getTime() - left.entryDate.getTime();
          }

          return right.createdAt.getTime() - left.createdAt.getTime();
        });

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) =>
          projectJournalEntry(candidate, {
            sourceCollectedTransaction:
              args.include?.sourceCollectedTransaction,
            lines: args.include?.lines
          })
        );
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          entryNumber: string;
          entryDate: Date;
          sourceKind:
            | 'COLLECTED_TRANSACTION'
            | 'PLAN_SETTLEMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD'
            | 'MANUAL_ADJUSTMENT';
          sourceCollectedTransactionId?: string;
          status: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          memo?: string | null;
          createdByActorType: AuditActorType;
          createdByMembershipId: string | null;
          lines: {
            create: Array<{
              lineNumber: number;
              accountSubjectId: string;
              fundingAccountId?: string;
              debitAmount: number;
              creditAmount: number;
              description?: string;
            }>;
          };
        };
        include?: {
          sourceCollectedTransaction?: {
            select?: { id?: boolean; title?: boolean };
          };
          lines?: {
            include?: {
              accountSubject?: {
                select?: { code?: boolean; name?: boolean };
              };
              fundingAccount?: {
                select?: { name?: boolean };
              };
            };
            orderBy?: { lineNumber?: 'asc' | 'desc' };
          };
        };
      }) => {
        const created = {
          id: `je-${state.journalEntries.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          entryNumber: args.data.entryNumber,
          entryDate: new Date(String(args.data.entryDate)),
          sourceKind: args.data.sourceKind,
          sourceCollectedTransactionId:
            args.data.sourceCollectedTransactionId ?? null,
          status: args.data.status,
          memo: args.data.memo ?? null,
          createdByActorType: args.data.createdByActorType,
          createdByMembershipId: args.data.createdByMembershipId,
          createdAt: new Date(),
          updatedAt: new Date(),
          lines: args.data.lines.create.map((line, index) => ({
            id: `jel-${state.journalEntries.length + 1}-${index + 1}`,
            lineNumber: line.lineNumber,
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: line.fundingAccountId ?? null,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description ?? null
          }))
        };

        state.journalEntries.push(created);

        if (!args.include) {
          return created;
        }

        return projectJournalEntry(created, {
          sourceCollectedTransaction: args.include.sourceCollectedTransaction,
          lines: args.include.lines
        });
      }
    },
    journalLine: {
      findMany: async (args: {
        where?: {
          journalEntry?: {
            tenantId?: string;
            ledgerId?: string;
            periodId?: string;
            status?: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          };
        };
        include?: {
          accountSubject?: {
            select?: {
              id?: boolean;
              code?: boolean;
              name?: boolean;
            };
          };
          fundingAccount?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
        };
      }) => {
        const entries = state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.journalEntry?.tenantId ||
            candidate.tenantId === args.where.journalEntry.tenantId;
          const matchesLedger =
            !args.where?.journalEntry?.ledgerId ||
            candidate.ledgerId === args.where.journalEntry.ledgerId;
          const matchesPeriod =
            !args.where?.journalEntry?.periodId ||
            candidate.periodId === args.where.journalEntry.periodId;
          const matchesStatus =
            !args.where?.journalEntry?.status ||
            candidate.status === args.where.journalEntry.status;

          return (
            matchesTenant && matchesLedger && matchesPeriod && matchesStatus
          );
        });

        return entries.flatMap((entry) =>
          entry.lines.map((line) => {
            const accountSubject = resolveAccountSubject(line.accountSubjectId);
            const fundingAccount = line.fundingAccountId
              ? resolveAccount(line.fundingAccountId)
              : null;

            return {
              ...line,
              ...(args.include?.accountSubject
                ? {
                    accountSubject: {
                      ...(args.include.accountSubject.select?.id
                        ? { id: accountSubject?.id ?? '' }
                        : {}),
                      ...(args.include.accountSubject.select?.code
                        ? { code: accountSubject?.code ?? '' }
                        : {}),
                      ...(args.include.accountSubject.select?.name
                        ? { name: accountSubject?.name ?? '' }
                        : {})
                    }
                  }
                : {}),
              ...(args.include?.fundingAccount
                ? {
                    fundingAccount: fundingAccount
                      ? {
                          ...(args.include.fundingAccount.select?.id
                            ? { id: fundingAccount.id }
                            : {}),
                          ...(args.include.fundingAccount.select?.name
                            ? { name: fundingAccount.name }
                            : {})
                        }
                      : null
                  }
                : {})
            };
          })
        );
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
        AccountingPeriodsModule,
        CarryForwardsModule,
        DashboardModule,
        FinancialStatementsModule,
        ForecastModule,
        JournalEntriesModule,
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
          name: '개인 장부',
          baseCurrency: 'KRW',
          timezone: 'Asia/Seoul',
          status: 'ACTIVE'
        }
      }
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
          name: '개인 장부',
          baseCurrency: 'KRW',
          timezone: 'Asia/Seoul',
          status: 'ACTIVE'
        }
      }
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
  } finally {
    await context.close();
  }
});

test('GET /accounting-periods returns the current ledger periods in reverse chronological order', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-existing-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-02-01T00:00:00.000Z'),
      lockedAt: new Date('2026-02-28T15:00:00.000Z'),
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-28T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-existing-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      reason: '운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-02-01T00:00:00.000Z')
    });
    context.state.openingBalanceSnapshots.push({
      id: 'opening-snapshot-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-existing-1',
      sourceKind: OpeningBalanceSourceKind.INITIAL_SETUP,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.accountingPeriods.push({
      id: 'period-other-1',
      tenantId: 'tenant-2',
      ledgerId: 'ledger-2',
      year: 2026,
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-02-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z')
    });

    const response = await context.request('/accounting-periods', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'period-existing-1',
        year: 2026,
        month: 2,
        monthLabel: '2026-02',
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-03-01T00:00:00.000Z',
        status: AccountingPeriodStatus.LOCKED,
        openedAt: '2026-02-01T00:00:00.000Z',
        lockedAt: '2026-02-28T15:00:00.000Z',
        hasOpeningBalanceSnapshot: true,
        openingBalanceSourceKind: OpeningBalanceSourceKind.INITIAL_SETUP,
        statusHistory: [
          {
            id: 'period-history-1',
            fromStatus: null,
            toStatus: AccountingPeriodStatus.OPEN,
            reason: '운영 시작',
            actorType: AuditActorType.TENANT_MEMBERSHIP,
            actorMembershipId: 'membership-1',
            changedAt: '2026-02-01T00:00:00.000Z'
          }
        ]
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods blocks the first period when opening balance initialization is missing', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/accounting-periods', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        month: '2026-03'
      }
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message: '첫 월 운영 시작에는 오프닝 잔액 스냅샷 생성이 필요합니다.',
      error: 'Bad Request'
    });
    assert.equal(context.state.accountingPeriods.length, 0);
    assert.equal(context.state.openingBalanceSnapshots.length, 0);
    assert.equal(context.state.periodStatusHistory.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods opens the first period and records status history with an opening balance snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/accounting-periods', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        month: '2026-03',
        initializeOpeningBalance: true,
        note: '2026년 3월 운영 시작'
      }
    });

    const createdPeriod = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(createdPeriod.monthLabel, '2026-03');
    assert.equal(createdPeriod.status, AccountingPeriodStatus.OPEN);
    assert.equal(createdPeriod.hasOpeningBalanceSnapshot, true);
    assert.equal(
      createdPeriod.openingBalanceSourceKind,
      OpeningBalanceSourceKind.INITIAL_SETUP
    );
    assert.equal(context.state.accountingPeriods.length, 1);
    assert.equal(context.state.openingBalanceSnapshots.length, 1);
    assert.equal(context.state.periodStatusHistory.length, 1);
    assert.equal(context.state.accountingPeriods[0]?.year, 2026);
    assert.equal(context.state.accountingPeriods[0]?.month, 3);
    assert.equal(
      context.state.periodStatusHistory[0]?.toStatus,
      AccountingPeriodStatus.OPEN
    );
    assert.equal(
      context.state.periodStatusHistory[0]?.actorMembershipId,
      'membership-1'
    );
  } finally {
    await context.close();
  }
});

test('GET /accounting-periods/current returns the currently open period for the active ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-current-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-current-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-current-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    const response = await context.request('/accounting-periods/current', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'period-current-1',
      year: 2026,
      month: 3,
      monthLabel: '2026-03',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-04-01T00:00:00.000Z',
      status: AccountingPeriodStatus.OPEN,
      openedAt: '2026-03-01T00:00:00.000Z',
      lockedAt: null,
      hasOpeningBalanceSnapshot: false,
      openingBalanceSourceKind: null,
      statusHistory: [
        {
          id: 'period-history-current-1',
          fromStatus: null,
          toStatus: AccountingPeriodStatus.OPEN,
          reason: '3월 운영 시작',
          actorType: AuditActorType.TENANT_MEMBERSHIP,
          actorMembershipId: 'membership-1',
          changedAt: '2026-03-01T00:00:00.000Z'
        }
      ]
    });
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/close locks the period and creates a closing snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-close-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-close-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.journalEntries.push({
      id: 'je-close-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-1',
      entryNumber: '202603-0001',
      entryDate: new Date('2026-03-12T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-2',
      status: 'POSTED',
      memo: 'Fuel refill',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-12T01:00:00.000Z'),
      updatedAt: new Date('2026-03-12T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-close-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 84_000,
          creditAmount: 0,
          description: 'Fuel refill'
        },
        {
          id: 'jel-close-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 84_000,
          description: 'Fuel refill'
        }
      ]
    });

    const response = await context.request(
      '/accounting-periods/period-close-1/close',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          note: '3월 월마감'
        }
      }
    );

    const body = response.body as CloseAccountingPeriodResponse;

    assert.equal(response.status, 201);
    assert.equal(body.period.status, AccountingPeriodStatus.LOCKED);
    assert.equal(context.state.closingSnapshots.length, 1);
    assert.equal(context.state.balanceSnapshotLines.length, 2);
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.toStatus,
      AccountingPeriodStatus.LOCKED
    );
    assert.equal(body.closingSnapshot.totalAssetAmount, -84_000);
    assert.equal(body.closingSnapshot.totalLiabilityAmount, 0);
    assert.equal(body.closingSnapshot.totalEquityAmount, -84_000);
    assert.equal(body.closingSnapshot.periodPnLAmount, -84_000);
    assert.equal(body.closingSnapshot.lines.length, 2);
  } finally {
    await context.close();
  }
});

test('POST /financial-statements/generate creates official statement snapshots for a locked period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-report-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-report-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-report-lock-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-1',
      fromStatus: AccountingPeriodStatus.OPEN,
      toStatus: AccountingPeriodStatus.LOCKED,
      reason: '3월 마감',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.closingSnapshots.push({
      id: 'closing-report-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-1',
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      totalAssetAmount: -84_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: -84_000,
      periodPnLAmount: -84_000,
      createdAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'balance-report-1',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-report-1',
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: -84_000
      },
      {
        id: 'balance-report-2',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-report-1',
        accountSubjectId: 'as-1-5100',
        fundingAccountId: null,
        balanceAmount: 84_000
      }
    );
    context.state.journalEntries.push({
      id: 'je-report-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-1',
      entryNumber: '202603-0009',
      entryDate: new Date('2026-03-20T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-2',
      status: 'POSTED',
      memo: 'Fuel refill',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-20T01:00:00.000Z'),
      updatedAt: new Date('2026-03-20T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-report-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 84_000,
          creditAmount: 0,
          description: 'Fuel refill'
        },
        {
          id: 'jel-report-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 84_000,
          description: 'Fuel refill'
        }
      ]
    });

    const response = await context.request('/financial-statements/generate', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        periodId: 'period-report-1'
      }
    });

    const body = response.body as FinancialStatementsView;
    const statementKinds = body.snapshots.map(
      (snapshot) => snapshot.statementKind
    );
    const positionStatement = body.snapshots.find(
      (snapshot) => snapshot.statementKind === 'STATEMENT_OF_FINANCIAL_POSITION'
    );
    const cashFlowStatement = body.snapshots.find(
      (snapshot) => snapshot.statementKind === 'CASH_FLOW_SUMMARY'
    );

    assert.equal(response.status, 201);
    assert.equal(body.period.id, 'period-report-1');
    assert.equal(body.snapshots.length, 4);
    assert.equal(context.state.financialStatementSnapshots.length, 4);
    assert.deepEqual(statementKinds, [
      'STATEMENT_OF_FINANCIAL_POSITION',
      'MONTHLY_PROFIT_AND_LOSS',
      'CASH_FLOW_SUMMARY',
      'NET_WORTH_MOVEMENT'
    ]);
    assert.equal(positionStatement?.payload.summary[0]?.amountWon, -84_000);
    assert.equal(cashFlowStatement?.payload.summary[2]?.amountWon, -84_000);
  } finally {
    await context.close();
  }
});

test('GET /financial-statements returns stored official statement snapshots for the selected locked period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-report-view-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 4,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-05-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-04-01T00:00:00.000Z'),
      lockedAt: new Date('2026-04-30T15:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-report-view-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-view-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      reason: '4월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-report-view-lock-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-view-1',
      fromStatus: AccountingPeriodStatus.OPEN,
      toStatus: AccountingPeriodStatus.LOCKED,
      reason: '4월 마감',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.financialStatementSnapshots.push(
      {
        id: 'financial-view-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        statementKind: FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
        currency: 'KRW',
        payload: {
          summary: [{ label: '자산 합계', amountWon: 3_000_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-04-30T15:10:00.000Z'),
        updatedAt: new Date('2026-04-30T15:10:00.000Z')
      },
      {
        id: 'financial-view-2',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        statementKind: FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
        currency: 'KRW',
        payload: {
          summary: [{ label: '당기 손익', amountWon: 120_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-04-30T15:10:00.000Z'),
        updatedAt: new Date('2026-04-30T15:10:00.000Z')
      },
      {
        id: 'financial-view-3',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        statementKind: FinancialStatementKind.CASH_FLOW_SUMMARY,
        currency: 'KRW',
        payload: {
          summary: [{ label: '순현금흐름', amountWon: 120_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-04-30T15:10:00.000Z'),
        updatedAt: new Date('2026-04-30T15:10:00.000Z')
      },
      {
        id: 'financial-view-4',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        statementKind: FinancialStatementKind.NET_WORTH_MOVEMENT,
        currency: 'KRW',
        payload: {
          summary: [{ label: '기말 순자산', amountWon: 3_120_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-04-30T15:10:00.000Z'),
        updatedAt: new Date('2026-04-30T15:10:00.000Z')
      }
    );

    const response = await context.request(
      '/financial-statements?periodId=period-report-view-1',
      {
        headers: context.authHeaders()
      }
    );

    const body = response.body as FinancialStatementsView;

    assert.equal(response.status, 200);
    assert.equal(body.period.id, 'period-report-view-1');
    assert.equal(body.period.monthLabel, '2026-04');
    assert.equal(body.snapshots.length, 4);
    assert.equal(
      body.snapshots[0]?.statementKind,
      'STATEMENT_OF_FINANCIAL_POSITION'
    );
    assert.equal(body.snapshots[3]?.statementKind, 'NET_WORTH_MOVEMENT');
  } finally {
    await context.close();
  }
});

test('POST /carry-forwards/generate creates a carry forward record and the next opening snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-carry-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 4,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-05-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-04-01T00:00:00.000Z'),
      lockedAt: new Date('2026-04-30T15:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-carry-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      reason: '4월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-carry-lock-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      fromStatus: AccountingPeriodStatus.OPEN,
      toStatus: AccountingPeriodStatus.LOCKED,
      reason: '4월 마감',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.closingSnapshots.push({
      id: 'closing-carry-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      lockedAt: new Date('2026-04-30T15:00:00.000Z'),
      totalAssetAmount: 2_916_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 2_916_000,
      periodPnLAmount: -84_000,
      createdAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'carry-balance-1',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-1',
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 2_916_000
      },
      {
        id: 'carry-balance-2',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-1',
        accountSubjectId: 'as-1-5100',
        fundingAccountId: null,
        balanceAmount: 84_000
      }
    );

    const response = await context.request('/carry-forwards/generate', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        fromPeriodId: 'period-carry-1'
      }
    });

    const body = response.body as CarryForwardView;

    assert.equal(response.status, 201);
    assert.equal(context.state.carryForwardRecords.length, 1);
    assert.equal(body.sourcePeriod.id, 'period-carry-1');
    assert.equal(body.targetPeriod.monthLabel, '2026-05');
    assert.equal(body.targetPeriod.status, AccountingPeriodStatus.OPEN);
    assert.equal(body.targetOpeningBalanceSnapshot.sourceKind, 'CARRY_FORWARD');
    assert.equal(body.targetOpeningBalanceSnapshot.lines.length, 1);
    assert.equal(
      body.targetOpeningBalanceSnapshot.lines[0]?.accountSubjectCode,
      '1010'
    );
    assert.equal(
      body.targetOpeningBalanceSnapshot.lines[0]?.balanceAmount,
      2_916_000
    );
  } finally {
    await context.close();
  }
});

test('GET /carry-forwards returns the stored carry forward view for the selected source period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-carry-view-source',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 5,
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-06-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.LOCKED,
        openedAt: new Date('2026-05-01T00:00:00.000Z'),
        lockedAt: new Date('2026-05-31T15:00:00.000Z'),
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-31T15:00:00.000Z')
      },
      {
        id: 'period-carry-view-target',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 6,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-07-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-06-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z')
      }
    );
    context.state.periodStatusHistory.push(
      {
        id: 'period-history-carry-view-source-open',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-source',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        reason: '5월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-05-01T00:00:00.000Z')
      },
      {
        id: 'period-history-carry-view-source-lock',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-source',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        reason: '5월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-05-31T15:00:00.000Z')
      },
      {
        id: 'period-history-carry-view-target-open',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-target',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        reason: '5월 이월 생성',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-06-01T00:00:00.000Z')
      }
    );
    context.state.closingSnapshots.push({
      id: 'closing-carry-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-view-source',
      lockedAt: new Date('2026-05-31T15:00:00.000Z'),
      totalAssetAmount: 3_120_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 3_120_000,
      periodPnLAmount: 120_000,
      createdAt: new Date('2026-05-31T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'carry-view-closing-line',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-view',
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 3_120_000
      },
      {
        id: 'carry-view-opening-line',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-carry-view',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 3_120_000
      }
    );
    context.state.openingBalanceSnapshots.push({
      id: 'opening-carry-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-carry-view-target',
      sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.carryForwardRecords.push({
      id: 'carry-record-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      fromPeriodId: 'period-carry-view-source',
      toPeriodId: 'period-carry-view-target',
      sourceClosingSnapshotId: 'closing-carry-view',
      createdJournalEntryId: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });

    const response = await context.request(
      '/carry-forwards?fromPeriodId=period-carry-view-source',
      {
        headers: context.authHeaders()
      }
    );

    const body = response.body as CarryForwardView;

    assert.equal(response.status, 200);
    assert.equal(body.carryForwardRecord.id, 'carry-record-view');
    assert.equal(body.sourcePeriod.monthLabel, '2026-05');
    assert.equal(body.targetPeriod.monthLabel, '2026-06');
    assert.equal(body.targetOpeningBalanceSnapshot.lines.length, 1);
    assert.equal(
      body.targetOpeningBalanceSnapshot.lines[0]?.accountSubjectCode,
      '1010'
    );
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
        id: 'ctx-seed-1',
        businessDate: '2026-03-25',
        title: 'March salary',
        type: TransactionType.INCOME,
        amountWon: 3_000_000,
        fundingAccountName: 'Main checking',
        categoryName: 'Salary',
        sourceKind: 'MANUAL',
        postingStatus: 'POSTED',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null
      },
      {
        id: 'ctx-seed-2',
        businessDate: '2026-03-20',
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84_000,
        fundingAccountName: 'Main checking',
        categoryName: 'Fuel',
        sourceKind: 'MANUAL',
        postingStatus: 'POSTED',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null
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
    const initialTransactionCount = context.state.collectedTransactions.length;
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
    assert.equal(
      context.state.collectedTransactions.length,
      initialTransactionCount
    );
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions returns 404 when the funding account is outside the current user scope', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-404',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    const initialTransactionCount = context.state.collectedTransactions.length;
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
    assert.equal(
      context.state.collectedTransactions.length,
      initialTransactionCount
    );
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
    context.state.accountingPeriods.push({
      id: 'period-open-created',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

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
      id: 'ctx-4',
      businessDate: '2026-03-03',
      title: 'Fuel refill',
      type: TransactionType.EXPENSE,
      amountWon: 84000,
      fundingAccountName: 'Main checking',
      categoryName: 'Fuel',
      sourceKind: 'MANUAL',
      postingStatus: 'PENDING',
      postedJournalEntryId: null,
      postedJournalEntryNumber: null
    });
    assert.equal(context.state.collectedTransactions.length, 4);
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions/:id/confirm creates a journal entry and marks the collected transaction as posted', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-confirm',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    context.state.collectedTransactions.push({
      id: 'ctx-confirm-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-confirm',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      title: 'Fuel refill',
      occurredOn: new Date('2026-03-03T00:00:00.000Z'),
      amount: 84000,
      status: CollectedTransactionStatus.COLLECTED,
      memo: 'Full tank',
      createdAt: new Date('2026-03-03T08:00:00.000Z'),
      updatedAt: new Date('2026-03-03T08:00:00.000Z')
    });

    const response = await context.request(
      '/collected-transactions/ctx-confirm-1/confirm',
      {
        method: 'POST',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'je-1',
      entryNumber: '202603-0001',
      entryDate: '2026-03-03T00:00:00.000Z',
      status: 'POSTED',
      sourceKind: 'COLLECTED_TRANSACTION',
      memo: 'Full tank',
      sourceCollectedTransactionId: 'ctx-confirm-1',
      sourceCollectedTransactionTitle: 'Fuel refill',
      lines: [
        {
          id: 'jel-1-1',
          lineNumber: 1,
          accountSubjectCode: '5100',
          accountSubjectName: '운영비용',
          fundingAccountName: null,
          debitAmount: 84000,
          creditAmount: 0,
          description: 'Fuel refill'
        },
        {
          id: 'jel-1-2',
          lineNumber: 2,
          accountSubjectCode: '1010',
          accountSubjectName: '현금및예금',
          fundingAccountName: 'Main checking',
          debitAmount: 0,
          creditAmount: 84000,
          description: 'Fuel refill'
        }
      ]
    });
    assert.equal(context.state.journalEntries.length, 1);
    assert.equal(
      context.state.collectedTransactions.find(
        (item) => item.id === 'ctx-confirm-1'
      )?.status,
      CollectedTransactionStatus.POSTED
    );
  } finally {
    await context.close();
  }
});

test('GET /journal-entries returns recent journal entries for the current ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.journalEntries.push({
      id: 'je-seed-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-seed-1',
      entryNumber: '202603-0003',
      entryDate: new Date('2026-03-20T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-2',
      status: 'POSTED',
      memo: 'Fuel refill',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-20T08:00:00.000Z'),
      updatedAt: new Date('2026-03-20T08:00:00.000Z'),
      lines: [
        {
          id: 'jel-seed-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 84000,
          creditAmount: 0,
          description: 'Fuel refill'
        },
        {
          id: 'jel-seed-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 84000,
          description: 'Fuel refill'
        }
      ]
    });
    context.state.journalEntries.push({
      id: 'je-other-1',
      tenantId: 'tenant-2',
      ledgerId: 'ledger-2',
      periodId: 'period-other-1',
      entryNumber: '202603-0001',
      entryDate: new Date('2026-03-21T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-3',
      status: 'POSTED',
      memo: 'Other user expense',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-2',
      createdAt: new Date('2026-03-21T08:00:00.000Z'),
      updatedAt: new Date('2026-03-21T08:00:00.000Z'),
      lines: []
    });

    const response = await context.request('/journal-entries', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'je-seed-1',
        entryNumber: '202603-0003',
        entryDate: '2026-03-20T00:00:00.000Z',
        status: 'POSTED',
        sourceKind: 'COLLECTED_TRANSACTION',
        memo: 'Fuel refill',
        sourceCollectedTransactionId: 'ctx-seed-2',
        sourceCollectedTransactionTitle: 'Fuel refill',
        lines: [
          {
            id: 'jel-seed-1',
            lineNumber: 1,
            accountSubjectCode: '5100',
            accountSubjectName: '운영비용',
            fundingAccountName: null,
            debitAmount: 84000,
            creditAmount: 0,
            description: 'Fuel refill'
          },
          {
            id: 'jel-seed-2',
            lineNumber: 2,
            accountSubjectCode: '1010',
            accountSubjectName: '현금및예금',
            fundingAccountName: 'Main checking',
            debitAmount: 0,
            creditAmount: 84000,
            description: 'Fuel refill'
          }
        ]
      }
    ]);
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
