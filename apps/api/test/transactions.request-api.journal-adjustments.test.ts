import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('POST /journal-entries/:id/reverse creates a reversal journal entry and marks the original entry as reversed', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-journal-source-1',

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
      },

      {
        id: 'period-journal-open-1',

        tenantId: 'tenant-1',

        ledgerId: 'ledger-1',

        year: 2026,

        month: 4,

        startDate: new Date('2026-04-01T00:00:00.000Z'),

        endDate: new Date('2026-05-01T00:00:00.000Z'),

        status: AccountingPeriodStatus.OPEN,

        openedAt: new Date('2026-04-01T00:00:00.000Z'),

        lockedAt: null,

        createdAt: new Date('2026-04-01T00:00:00.000Z'),

        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      },

      {
        id: 'period-journal-open-latest-1',

        tenantId: 'tenant-1',

        ledgerId: 'ledger-1',

        year: 2026,

        month: 5,

        startDate: new Date('2026-05-01T00:00:00.000Z'),

        endDate: new Date('2026-06-01T00:00:00.000Z'),

        status: AccountingPeriodStatus.OPEN,

        openedAt: new Date('2026-05-01T00:00:00.000Z'),

        lockedAt: null,

        createdAt: new Date('2026-05-01T00:00:00.000Z'),

        updatedAt: new Date('2026-05-01T00:00:00.000Z')
      }
    );

    context.state.collectedTransactions.push({
      id: 'ctx-journal-reverse-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-journal-source-1',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'March fuel expense',

      occurredOn: new Date('2026-03-28T00:00:00.000Z'),

      amount: 84_000,

      status: CollectedTransactionStatus.POSTED,

      memo: 'March fuel expense',

      createdAt: new Date('2026-03-28T08:00:00.000Z'),

      updatedAt: new Date('2026-03-28T08:00:00.000Z')
    });

    context.state.journalEntries.push({
      id: 'je-reverse-source-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-journal-source-1',

      entryNumber: '202603-0003',

      entryDate: new Date('2026-03-28T00:00:00.000Z'),

      sourceKind: 'COLLECTED_TRANSACTION',

      sourceCollectedTransactionId: 'ctx-journal-reverse-1',

      status: 'POSTED',

      memo: 'March fuel expense',

      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,

      createdByMembershipId: 'membership-1',

      createdAt: new Date('2026-03-28T08:05:00.000Z'),

      updatedAt: new Date('2026-03-28T08:05:00.000Z'),

      lines: [
        {
          id: 'jel-reverse-source-1',

          lineNumber: 1,

          accountSubjectId: 'as-1-5100',

          fundingAccountId: null,

          debitAmount: 84_000,

          creditAmount: 0,

          description: 'March fuel expense'
        },

        {
          id: 'jel-reverse-source-2',

          lineNumber: 2,

          accountSubjectId: 'as-1-1010',

          fundingAccountId: 'acc-1',

          debitAmount: 0,

          creditAmount: 84_000,

          description: 'March fuel expense'
        }
      ]
    });

    const response = await context.request(
      '/journal-entries/je-reverse-source-1/reverse',

      {
        method: 'POST',

        headers: context.authHeaders(),

        body: {
          entryDate: '2026-04-03',

          reason: 'Reverse the March fuel entry.'
        }
      }
    );

    const body = response.body as Record<string, unknown>;

    const createdJournalEntry = context.state.journalEntries.find(
      (candidate) => candidate.id === 'je-2'
    );

    assert.equal(response.status, 201);

    assert.equal(body.id, 'je-2');

    assert.equal(body.entryNumber, '202604-0001');

    assert.equal(createdJournalEntry?.periodId, 'period-journal-open-1');

    assert.equal(body.sourceKind, 'MANUAL_ADJUSTMENT');

    assert.equal(body.status, 'POSTED');

    assert.equal(body.memo, 'Reverse the March fuel entry.');

    assert.equal(body.reversesJournalEntryId, 'je-reverse-source-1');

    assert.equal(body.reversesJournalEntryNumber, '202603-0003');

    assert.equal(body.reversedByJournalEntryId, null);

    assert.equal(body.correctsJournalEntryId, null);

    assert.deepEqual(body.correctionEntryIds, []);

    assert.deepEqual(body.correctionEntryNumbers, []);

    assert.equal(body.correctionReason, null);

    assert.equal(body.createdByActorType, AuditActorType.TENANT_MEMBERSHIP);

    assert.equal(body.createdByMembershipId, 'membership-1');

    assert.equal(
      context.state.journalEntries.find(
        (candidate) => candidate.id === 'je-reverse-source-1'
      )?.status,

      'REVERSED'
    );

    assert.equal(
      createdJournalEntry?.reversesJournalEntryId,

      'je-reverse-source-1'
    );

    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-journal-reverse-1'
      )?.status,

      CollectedTransactionStatus.CORRECTED
    );

    assert.deepEqual(
      createdJournalEntry?.lines.map((line) => ({
        lineNumber: line.lineNumber,

        debitAmount: line.debitAmount,

        creditAmount: line.creditAmount,

        accountSubjectId: line.accountSubjectId,

        fundingAccountId: line.fundingAccountId
      })),

      [
        {
          lineNumber: 1,

          debitAmount: 0,

          creditAmount: 84_000,

          accountSubjectId: 'as-1-5100',

          fundingAccountId: null
        },

        {
          lineNumber: 2,

          debitAmount: 84_000,

          creditAmount: 0,

          accountSubjectId: 'as-1-1010',

          fundingAccountId: 'acc-1'
        }
      ]
    );

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'journal_entry.reverse' &&
          candidate.details.journalEntryId === 'je-reverse-source-1' &&
          candidate.details.adjustmentJournalEntryId === 'je-2'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /journal-entries/:id/reverse returns 403 when the current membership role cannot reverse journal entries', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request(
      '/journal-entries/je-reverse-denied-1/reverse',

      {
        method: 'POST',

        headers: context.authHeaders(),

        body: {
          entryDate: '2026-04-03'
        }
      }
    );

    assert.equal(response.status, 403);

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'journal_entry.reverse' &&
          candidate.details.journalEntryId === 'je-reverse-denied-1' &&
          candidate.details.membershipRole === 'EDITOR'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /journal-entries/:id/correct creates a correction journal entry and marks the original entry as superseded', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-journal-correct-source',

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
      },

      {
        id: 'period-journal-correct-open',

        tenantId: 'tenant-1',

        ledgerId: 'ledger-1',

        year: 2026,

        month: 4,

        startDate: new Date('2026-04-01T00:00:00.000Z'),

        endDate: new Date('2026-05-01T00:00:00.000Z'),

        status: AccountingPeriodStatus.OPEN,

        openedAt: new Date('2026-04-01T00:00:00.000Z'),

        lockedAt: null,

        createdAt: new Date('2026-04-01T00:00:00.000Z'),

        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      },

      {
        id: 'period-journal-correct-open-latest',

        tenantId: 'tenant-1',

        ledgerId: 'ledger-1',

        year: 2026,

        month: 5,

        startDate: new Date('2026-05-01T00:00:00.000Z'),

        endDate: new Date('2026-06-01T00:00:00.000Z'),

        status: AccountingPeriodStatus.OPEN,

        openedAt: new Date('2026-05-01T00:00:00.000Z'),

        lockedAt: null,

        createdAt: new Date('2026-05-01T00:00:00.000Z'),

        updatedAt: new Date('2026-05-01T00:00:00.000Z')
      }
    );

    context.state.collectedTransactions.push({
      id: 'ctx-journal-correct-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-journal-correct-source',

      ledgerTransactionTypeId: 'ltt-1-expense',

      fundingAccountId: 'acc-1',

      categoryId: 'cat-1',

      matchedPlanItemId: null,

      importBatchId: null,

      importedRowId: null,

      sourceFingerprint: null,

      title: 'Fuel expense to correct',

      occurredOn: new Date('2026-03-27T00:00:00.000Z'),

      amount: 84_000,

      status: CollectedTransactionStatus.POSTED,

      memo: 'Fuel expense to correct',

      createdAt: new Date('2026-03-27T08:00:00.000Z'),

      updatedAt: new Date('2026-03-27T08:00:00.000Z')
    });

    context.state.journalEntries.push({
      id: 'je-correct-source-1',

      tenantId: 'tenant-1',

      ledgerId: 'ledger-1',

      periodId: 'period-journal-correct-source',

      entryNumber: '202603-0004',

      entryDate: new Date('2026-03-27T00:00:00.000Z'),

      sourceKind: 'COLLECTED_TRANSACTION',

      sourceCollectedTransactionId: 'ctx-journal-correct-1',

      status: 'POSTED',

      memo: 'Fuel expense to correct',

      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,

      createdByMembershipId: 'membership-1',

      createdAt: new Date('2026-03-27T08:05:00.000Z'),

      updatedAt: new Date('2026-03-27T08:05:00.000Z'),

      lines: [
        {
          id: 'jel-correct-source-1',

          lineNumber: 1,

          accountSubjectId: 'as-1-5100',

          fundingAccountId: null,

          debitAmount: 84_000,

          creditAmount: 0,

          description: 'Fuel expense to correct'
        },

        {
          id: 'jel-correct-source-2',

          lineNumber: 2,

          accountSubjectId: 'as-1-1010',

          fundingAccountId: 'acc-1',

          debitAmount: 0,

          creditAmount: 84_000,

          description: 'Fuel expense to correct'
        }
      ]
    });

    const response = await context.request(
      '/journal-entries/je-correct-source-1/correct',

      {
        method: 'POST',

        headers: context.authHeaders(),

        body: {
          entryDate: '2026-04-04',

          reason: 'Adjust the posted amount after invoice verification.',

          lines: [
            {
              accountSubjectId: 'as-1-5100',

              debitAmount: 95_000,

              creditAmount: 0,

              description: 'Adjusted fuel expense'
            },

            {
              accountSubjectId: 'as-1-1010',

              fundingAccountId: 'acc-1',

              debitAmount: 0,

              creditAmount: 95_000,

              description: 'Adjusted bank outflow'
            }
          ]
        }
      }
    );

    const body = response.body as Record<string, unknown>;

    const createdJournalEntry = context.state.journalEntries.find(
      (candidate) => candidate.id === 'je-2'
    );

    assert.equal(response.status, 201);

    assert.equal(body.id, 'je-2');

    assert.equal(body.entryNumber, '202604-0001');

    assert.equal(createdJournalEntry?.periodId, 'period-journal-correct-open');

    assert.equal(body.sourceKind, 'MANUAL_ADJUSTMENT');

    assert.equal(body.status, 'POSTED');

    assert.equal(
      body.memo,

      'Adjust the posted amount after invoice verification.'
    );

    assert.equal(body.reversesJournalEntryId, null);

    assert.equal(body.correctsJournalEntryId, 'je-correct-source-1');

    assert.equal(body.correctsJournalEntryNumber, '202603-0004');

    assert.deepEqual(body.correctionEntryIds, []);

    assert.deepEqual(body.correctionEntryNumbers, []);

    assert.equal(
      body.correctionReason,

      'Adjust the posted amount after invoice verification.'
    );

    assert.equal(body.createdByActorType, AuditActorType.TENANT_MEMBERSHIP);

    assert.equal(body.createdByMembershipId, 'membership-1');

    assert.equal(
      context.state.journalEntries.find(
        (candidate) => candidate.id === 'je-correct-source-1'
      )?.status,

      'SUPERSEDED'
    );

    assert.equal(
      createdJournalEntry?.correctsJournalEntryId,

      'je-correct-source-1'
    );

    assert.equal(
      createdJournalEntry?.correctionReason,

      'Adjust the posted amount after invoice verification.'
    );

    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-journal-correct-1'
      )?.status,

      CollectedTransactionStatus.CORRECTED
    );

    assert.deepEqual(
      createdJournalEntry?.lines.map((line) => ({
        lineNumber: line.lineNumber,

        debitAmount: line.debitAmount,

        creditAmount: line.creditAmount,

        accountSubjectId: line.accountSubjectId,

        fundingAccountId: line.fundingAccountId,

        description: line.description
      })),

      [
        {
          lineNumber: 1,

          debitAmount: 95_000,

          creditAmount: 0,

          accountSubjectId: 'as-1-5100',

          fundingAccountId: null,

          description: 'Adjusted fuel expense'
        },

        {
          lineNumber: 2,

          debitAmount: 0,

          creditAmount: 95_000,

          accountSubjectId: 'as-1-1010',

          fundingAccountId: 'acc-1',

          description: 'Adjusted bank outflow'
        }
      ]
    );

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'journal_entry.correct' &&
          candidate.details.journalEntryId === 'je-correct-source-1' &&
          candidate.details.adjustmentJournalEntryId === 'je-2'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /journal-entries/:id/correct returns 403 when the current membership role cannot correct journal entries', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request(
      '/journal-entries/je-correct-denied-1/correct',

      {
        method: 'POST',

        headers: context.authHeaders(),

        body: {
          entryDate: '2026-04-04',

          reason: 'Adjust the posted amount after invoice verification.',

          lines: [
            {
              accountSubjectId: 'as-1-5100',

              debitAmount: 95_000,

              creditAmount: 0,

              description: 'Adjusted fuel expense'
            },

            {
              accountSubjectId: 'as-1-1010',

              fundingAccountId: 'acc-1',

              debitAmount: 0,

              creditAmount: 95_000,

              description: 'Adjusted bank outflow'
            }
          ]
        }
      }
    );

    assert.equal(response.status, 403);

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'journal_entry.correct' &&
          candidate.details.journalEntryId === 'je-correct-denied-1' &&
          candidate.details.membershipRole === 'EDITOR'
      )
    );
  } finally {
    await context.close();
  }
});
