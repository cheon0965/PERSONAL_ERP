import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountingPeriodStatus, AuditActorType } from '@prisma/client';
import { createRequestTestContext } from '../../../support/request-api/index';

test('GET /funding-accounts returns only active funding accounts for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'acc-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 2_000_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /funding-accounts?includeInactive=true includes inactive funding accounts for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-1c',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 3,
      status: 'INACTIVE'
    });

    const response = await context.request(
      '/funding-accounts?includeInactive=true',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'acc-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 2_000_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1c',
        name: 'Legacy cashbox',
        type: 'CASH',
        balanceWon: 0,
        status: 'INACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /funding-accounts derives a live balance from opening data and transactions when stored balance is zero', async () => {
  const context = await createRequestTestContext();

  try {
    const acc1 = context.state.accounts.find((a) => a.id === 'acc-1');
    if (acc1) {
      acc1.balanceWon = 0;
    }

    context.state.accountingPeriods.push({
      id: 'period-live-balance-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      nextJournalEntrySequence: 2,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.openingBalanceSnapshots.push({
      id: 'opening-live-balance-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-live-balance-1',
      sourceKind: 'INITIAL_SETUP',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.balanceSnapshotLines.push({
      id: 'balance-live-opening-1',
      snapshotKind: 'OPENING',
      openingSnapshotId: 'opening-live-balance-1',
      closingSnapshotId: null,
      accountSubjectId: 'as-1-1010',
      fundingAccountId: 'acc-1',
      balanceAmount: 1_000_000
    });
    context.state.journalEntries.push({
      id: 'je-live-before-import-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-live-balance-1',
      entryNumber: '202603-0001',
      entryDate: new Date('2026-03-05T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-live-before-import-1',
      reversesJournalEntryId: null,
      correctsJournalEntryId: null,
      correctionReason: null,
      status: 'POSTED',
      memo: 'Imported before anchor',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-05T01:00:00.000Z'),
      updatedAt: new Date('2026-03-05T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-live-before-import-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 50_000,
          creditAmount: 0,
          description: 'Imported before anchor'
        },
        {
          id: 'jel-live-before-import-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-4100',
          fundingAccountId: null,
          debitAmount: 0,
          creditAmount: 50_000,
          description: 'Imported before anchor'
        }
      ]
    });
    context.state.collectedTransactions.push(
      {
        id: 'ctx-live-before-import-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-live-balance-1',
        ledgerTransactionTypeId: 'ltt-1-income',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1b',
        matchedPlanItemId: null,
        importBatchId: null,
        importedRowId: null,
        sourceFingerprint: null,
        title: 'Imported before anchor',
        occurredOn: new Date('2026-03-05T00:00:00.000Z'),
        amount: 50_000,
        status: 'POSTED',
        memo: null,
        createdAt: new Date('2026-03-05T01:00:00.000Z'),
        updatedAt: new Date('2026-03-05T01:00:00.000Z')
      },
      {
        id: 'ctx-live-import-anchor-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-live-balance-1',
        ledgerTransactionTypeId: 'ltt-1-income',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1b',
        matchedPlanItemId: null,
        importBatchId: 'batch-live-balance-1',
        importedRowId: 'row-live-balance-1',
        sourceFingerprint: 'sf-live-anchor-1',
        title: 'Statement anchor deposit',
        occurredOn: new Date('2026-03-10T00:00:00.000Z'),
        amount: 120_000,
        status: 'READY_TO_POST',
        memo: null,
        createdAt: new Date('2026-03-10T00:30:00.000Z'),
        updatedAt: new Date('2026-03-10T00:30:00.000Z')
      },
      {
        id: 'ctx-live-after-anchor-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-live-balance-1',
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: null,
        importBatchId: null,
        importedRowId: null,
        sourceFingerprint: null,
        title: 'After anchor expense',
        occurredOn: new Date('2026-03-11T00:00:00.000Z'),
        amount: 10_000,
        status: 'READY_TO_POST',
        memo: null,
        createdAt: new Date('2026-03-11T01:00:00.000Z'),
        updatedAt: new Date('2026-03-11T01:00:00.000Z')
      }
    );
    context.state.importBatches.push({
      id: 'batch-live-balance-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-live-balance-1',
      sourceKind: 'IM_BANK_PDF',
      fileName: 'live-balance.pdf',
      fileHash: 'file-hash-live-balance-1',
      fundingAccountId: 'acc-1',
      rowCount: 1,
      parseStatus: 'COMPLETED',
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    context.state.importedRows.push({
      id: 'row-live-balance-1',
      batchId: 'batch-live-balance-1',
      rowNumber: 10,
      rawPayload: {
        parsed: {
          occurredOn: '2026-03-10',
          occurredAt: '2026-03-10T09:00:00+09:00',
          title: 'Statement anchor deposit',
          amount: 120_000,
          signedAmount: 120_000,
          balanceAfter: 1_120_000,
          direction: 'DEPOSIT'
        }
      },
      parseStatus: 'PARSED',
      parseError: null,
      sourceFingerprint: 'sf-live-anchor-1'
    });

    const response = await context.request('/funding-accounts', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'acc-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 1_160_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    ]);
  } finally {
    await context.close();
  }
});
