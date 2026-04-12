import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

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

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill',

      occurredOn: new Date('2026-03-03T00:00:00.000Z'),

      amount: 84000,

      status: CollectedTransactionStatus.READY_TO_POST,

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

      reversesJournalEntryId: null,

      reversesJournalEntryNumber: null,

      reversedByJournalEntryId: null,

      reversedByJournalEntryNumber: null,

      correctsJournalEntryId: null,

      correctsJournalEntryNumber: null,

      correctionEntryIds: [],

      correctionEntryNumbers: [],

      correctionReason: null,

      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,

      createdByMembershipId: 'membership-1',

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

    assert.equal(
      context.state.journalEntries[0]?.createdByActorType,

      AuditActorType.TENANT_MEMBERSHIP
    );

    assert.equal(
      context.state.journalEntries[0]?.createdByMembershipId,

      'membership-1'
    );

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.confirm' &&
          candidate.details.collectedTransactionId === 'ctx-confirm-1' &&
          candidate.details.journalEntryId === 'je-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions/:id/confirm uses the allocated journal sequence instead of recounting existing entries', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-confirm-sequence',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      nextJournalEntrySequence: 10,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    context.state.collectedTransactions.push({
      id: 'ctx-confirm-sequence-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-confirm-sequence',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: null,
      title: 'Sequence test',
      occurredOn: new Date('2026-03-15T00:00:00.000Z'),
      amount: 42_000,
      status: CollectedTransactionStatus.READY_TO_POST,
      memo: null,
      createdAt: new Date('2026-03-15T08:00:00.000Z'),
      updatedAt: new Date('2026-03-15T08:00:00.000Z')
    });

    const response = await context.request(
      '/collected-transactions/ctx-confirm-sequence-1/confirm',
      {
        method: 'POST',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 201);
    assert.equal(
      (response.body as { entryNumber: string }).entryNumber,
      '202603-0010'
    );
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-open-confirm-sequence'
      )?.nextJournalEntrySequence,
      11
    );
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions/:id/confirm re-checks the transaction inside the transaction boundary before posting', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-confirm-race',

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
      id: 'ctx-confirm-race-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-open-confirm-race',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill',

      occurredOn: new Date('2026-03-03T00:00:00.000Z'),

      amount: 84000,

      status: CollectedTransactionStatus.READY_TO_POST,

      memo: 'Full tank',

      createdAt: new Date('2026-03-03T08:00:00.000Z'),

      updatedAt: new Date('2026-03-03T08:00:00.000Z')
    });

    context.state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId =
      'ctx-confirm-race-1';

    const response = await context.request(
      '/collected-transactions/ctx-confirm-race-1/confirm',

      {
        method: 'POST',

        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);

    assert.deepEqual(response.body, {
      statusCode: 409,

      message: 'Collected transaction is already posted.',

      error: 'Conflict'
    });

    assert.equal(
      context.state.journalEntries.filter(
        (candidate) =>
          candidate.sourceCollectedTransactionId === 'ctx-confirm-race-1'
      ).length,

      1
    );

    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-confirm-race-1'
      )?.status,

      CollectedTransactionStatus.POSTED
    );
  } finally {
    await context.close();
  }
});

test('POST /collected-transactions/:id/confirm returns 403 when the current membership role cannot confirm', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    context.state.accountingPeriods.push({
      id: 'period-open-confirm-denied',

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
      id: 'ctx-confirm-denied-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-open-confirm-denied',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel refill',

      occurredOn: new Date('2026-03-03T00:00:00.000Z'),

      amount: 84000,

      status: CollectedTransactionStatus.READY_TO_POST,

      memo: 'Full tank',

      createdAt: new Date('2026-03-03T08:00:00.000Z'),

      updatedAt: new Date('2026-03-03T08:00:00.000Z')
    });

    const response = await context.request(
      '/collected-transactions/ctx-confirm-denied-1/confirm',

      {
        method: 'POST',

        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 403);

    assert.equal(context.state.journalEntries.length, 0);

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.confirm' &&
          candidate.details.collectedTransactionId === 'ctx-confirm-denied-1' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});
