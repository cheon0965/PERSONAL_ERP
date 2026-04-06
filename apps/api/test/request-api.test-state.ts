import * as argon2 from 'argon2';
import {
  CollectedTransactionStatus,
  LedgerTransactionFlowKind,
  RecurrenceFrequency,
  TransactionOrigin,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import type { RequestTestState } from './request-api.test-types';

const demoPasswordHashPromise = argon2.hash('Demo1234!');

export async function createRequestTestState(): Promise<RequestTestState> {
  const passwordHash = await demoPasswordHashPromise;
  const activeSessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    databaseReady: true,
    failOpeningBalanceSnapshotCreate: false,
    simulateCollectedTransactionAlreadyPostedOnNextTransactionId: null,
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
        name: '사업 장부',
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
        name: '기본 수입',
        flowKind: LedgerTransactionFlowKind.INCOME,
        postingPolicyKey: 'INCOME_BASIC',
        isActive: true
      },
      {
        id: 'ltt-1-expense',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: 'EXPENSE_BASIC',
        name: '기본 지출',
        flowKind: LedgerTransactionFlowKind.EXPENSE,
        postingPolicyKey: 'EXPENSE_BASIC',
        isActive: true
      },
      {
        id: 'ltt-1-transfer',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: 'TRANSFER_BASIC',
        name: '기본 이체',
        flowKind: LedgerTransactionFlowKind.TRANSFER,
        postingPolicyKey: 'TRANSFER_BASIC',
        isActive: true
      },
      {
        id: 'ltt-2-expense',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: 'EXPENSE_BASIC',
        name: '기본 지출',
        flowKind: LedgerTransactionFlowKind.EXPENSE,
        postingPolicyKey: 'EXPENSE_BASIC',
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
    importBatches: [],
    importedRows: [],
    accountSubjects: [
      {
        id: 'as-1-1010',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '1010',
        name: '현금및예금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'DEBIT',
        subjectKind: 'ASSET',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-2010',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '2010',
        name: '카드대금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'LIABILITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-3010',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '3010',
        name: '사업자본',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'EQUITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-4100',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '4100',
        name: '운영수익',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'CREDIT',
        subjectKind: 'INCOME',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-5100',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '5100',
        name: '운영비용',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'DEBIT',
        subjectKind: 'EXPENSE',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-1010',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '1010',
        name: '현금및예금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'DEBIT',
        subjectKind: 'ASSET',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-2010',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '2010',
        name: '카드대금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'LIABILITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-3010',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '3010',
        name: '사업자본',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'EQUITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-4100',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '4100',
        name: '운영수익',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'CREDIT',
        subjectKind: 'INCOME',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-5100',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '5100',
        name: '운영비용',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'DEBIT',
        subjectKind: 'EXPENSE',
        isSystem: true,
        isActive: true
      }
    ],
    authSessions: [
      {
        id: 'session-user-1',
        userId: 'user-1',
        refreshTokenHash: 'existing-session-hash',
        expiresAt: activeSessionExpiresAt,
        revokedAt: null
      },
      {
        id: 'session-user-2',
        userId: 'user-2',
        refreshTokenHash: 'existing-session-hash',
        expiresAt: activeSessionExpiresAt,
        revokedAt: null
      }
    ],
    accounts: [
      {
        id: 'acc-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 2_000_000,
        sortOrder: 0,
        status: 'ACTIVE'
      },
      {
        id: 'acc-1b',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        sortOrder: 1,
        status: 'ACTIVE'
      },
      {
        id: 'acc-2',
        userId: 'user-2',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        name: 'Other account',
        type: 'BANK',
        balanceWon: 9_000_000,
        sortOrder: 0,
        status: 'ACTIVE'
      }
    ],
    categories: [
      {
        id: 'cat-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Fuel',
        kind: 'EXPENSE',
        isActive: true
      },
      {
        id: 'cat-1b',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Salary',
        kind: 'INCOME',
        isActive: true
      },
      {
        id: 'cat-1c',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Utilities',
        kind: 'EXPENSE',
        isActive: true
      },
      {
        id: 'cat-2',
        userId: 'user-2',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        name: 'Other category',
        kind: 'EXPENSE',
        isActive: true
      }
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
        importedRowId: null,
        sourceFingerprint: null,
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
        importedRowId: null,
        sourceFingerprint: null,
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
        importedRowId: null,
        sourceFingerprint: null,
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
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
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
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
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
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
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
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
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
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
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
    planItems: [],
    journalEntries: [],
    insurancePolicies: [
      {
        id: 'policy-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        provider: '삼성화재',
        productName: '업무용 차량 보험',
        monthlyPremiumWon: 42_000,
        paymentDay: 25,
        cycle: 'MONTHLY',
        accountId: 'acc-1',
        categoryId: 'cat-1c',
        recurringStartDate: new Date('2026-03-25T00:00:00.000Z'),
        linkedRecurringRuleId: null,
        renewalDate: new Date('2026-11-01T00:00:00.000Z'),
        maturityDate: null,
        isActive: true
      },
      {
        id: 'policy-2',
        userId: 'user-2',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        provider: 'DB손해보험',
        productName: '사업장 화재 보험',
        monthlyPremiumWon: 250_000,
        paymentDay: 20,
        cycle: 'MONTHLY',
        accountId: 'acc-2',
        categoryId: 'cat-2',
        recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
        linkedRecurringRuleId: null,
        renewalDate: new Date('2026-10-15T00:00:00.000Z'),
        maturityDate: null,
        isActive: true
      }
    ],
    vehicles: [
      {
        id: 'vehicle-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: '배송 밴',
        manufacturer: 'Hyundai',
        fuelType: 'DIESEL',
        initialOdometerKm: 58_200,
        monthlyExpenseWon: 130_000,
        estimatedFuelEfficiencyKmPerLiter: 11.2,
        createdAt: new Date('2026-03-01T08:00:00.000Z'),
        fuelLogs: [
          {
            id: 'fuel-1',
            filledOn: new Date('2026-03-05T00:00:00.000Z'),
            odometerKm: 58_480,
            liters: 42.5,
            amountWon: 72_000,
            unitPriceWon: 1694,
            isFullTank: true
          }
        ]
      },
      {
        id: 'vehicle-2',
        userId: 'user-2',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        name: '기타 차량',
        manufacturer: 'Kia',
        fuelType: 'GASOLINE',
        initialOdometerKm: 12_000,
        monthlyExpenseWon: 410_000,
        estimatedFuelEfficiencyKmPerLiter: 9.4,
        createdAt: new Date('2026-03-02T08:00:00.000Z'),
        fuelLogs: []
      }
    ],
    vehicleMaintenanceLogs: [
      {
        id: 'maintenance-1',
        vehicleId: 'vehicle-1',
        performedOn: new Date('2026-03-18T00:00:00.000Z'),
        odometerKm: 58_620,
        category: 'REPAIR',
        vendor: '현대 블루핸즈',
        description: '브레이크 패드 교체',
        amountWon: 185_000,
        memo: '전륜 패드 기준',
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        updatedAt: new Date('2026-03-18T10:00:00.000Z')
      }
    ]
  };
}
