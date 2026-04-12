import {
  CollectedTransactionStatus,
  RecurrenceFrequency
} from '@prisma/client';
import type { RequestTestState } from './request-api.test-types';

export function createRequestOperationsStateFixtures(): Pick<
  RequestTestState,
  'collectedTransactions' | 'recurringRules' | 'planItems' | 'journalEntries'
> {
  return {
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
    journalEntries: []
  };
}
