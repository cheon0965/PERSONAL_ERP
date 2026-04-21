import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AuditActorType,
  CollectedTransactionStatus,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

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
        postedJournalEntryNumber: null,
        matchedPlanItemId: null,
        matchedPlanItemTitle: null
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
        postedJournalEntryNumber: null,
        matchedPlanItemId: null,
        matchedPlanItemTitle: null
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

test('GET /collected-transactions returns more than 100 current ledger rows', async () => {
  const context = await createRequestTestContext();

  try {
    for (let index = 0; index < 125; index += 1) {
      const day = String((index % 28) + 1).padStart(2, '0');
      const createdAt = new Date(
        `2026-04-${day}T${String(index % 24).padStart(2, '0')}:00:00.000Z`
      );

      context.state.collectedTransactions.push({
        id: `ctx-bulk-${index + 1}`,
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: null,
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: null,
        importBatchId: 'import-batch-bulk',
        importedRowId: `imported-row-bulk-${index + 1}`,
        sourceFingerprint: `bulk-fingerprint-${index + 1}`,
        title: `Bulk uploaded row ${index + 1}`,
        occurredOn: new Date(`2026-04-${day}T00:00:00.000Z`),
        amount: 10_000 + index,
        status: CollectedTransactionStatus.READY_TO_POST,
        memo: null,
        createdAt,
        updatedAt: createdAt
      });
    }

    const response = await context.request('/collected-transactions', {
      headers: context.authHeaders()
    });

    const items = response.body as Array<Record<string, unknown>>;

    assert.equal(response.status, 200);
    assert.equal(items.length, 127);
    assert.ok(items.some((item) => item.id === 'ctx-bulk-125'));
    assert.equal(
      items.some((item) => item.id === 'ctx-seed-3'),
      false
    );
  } finally {
    await context.close();
  }
});

test('GET /collected-transactions keeps corrected transactions visible as CORRECTED instead of CANCELLED', async () => {
  const context = await createRequestTestContext();

  try {
    const correctedTransaction = context.state.collectedTransactions.find(
      (candidate) => candidate.id === 'ctx-seed-2'
    );
    assert.ok(correctedTransaction);
    correctedTransaction.status = CollectedTransactionStatus.CORRECTED;

    const response = await context.request('/collected-transactions', {
      headers: context.authHeaders()
    });

    const items = response.body as Array<Record<string, unknown>>;
    const item = items.find((candidate) => candidate.id === 'ctx-seed-2');

    assert.equal(response.status, 200);
    assert.ok(item);
    assert.equal(item.postingStatus, 'CORRECTED');
  } finally {
    await context.close();
  }
});

test('GET /collected-transactions/:id returns the collected transaction detail without ownership fields', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request(
      '/collected-transactions/ctx-seed-2',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'ctx-seed-2',
      businessDate: '2026-03-20',
      title: 'Fuel refill',
      type: TransactionType.EXPENSE,
      amountWon: 84_000,
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      memo: 'Full tank',
      sourceKind: 'MANUAL',
      postingStatus: 'POSTED',
      postedJournalEntryId: null,
      postedJournalEntryNumber: null,
      matchedPlanItemId: null,
      matchedPlanItemTitle: null
    });
    assert.equal(
      'tenantId' in (response.body as Record<string, unknown>),
      false
    );
    assert.equal(
      'ledgerId' in (response.body as Record<string, unknown>),
      false
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
      status: 'SUPERSEDED',
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
      id: 'je-seed-1-c1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-seed-1',
      entryNumber: '202603-0004',
      entryDate: new Date('2026-03-21T00:00:00.000Z'),
      sourceKind: 'MANUAL_ADJUSTMENT',
      sourceCollectedTransactionId: null,
      correctsJournalEntryId: 'je-seed-1',
      correctionReason: 'Corrected fuel amount',
      status: 'POSTED',
      memo: 'Corrected fuel amount',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-21T08:00:00.000Z'),
      updatedAt: new Date('2026-03-21T08:00:00.000Z'),
      lines: [
        {
          id: 'jel-seed-1-c1-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 95_000,
          creditAmount: 0,
          description: 'Corrected fuel amount'
        },
        {
          id: 'jel-seed-1-c1-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 95_000,
          description: 'Corrected fuel amount'
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
        id: 'je-seed-1-c1',
        entryNumber: '202603-0004',
        entryDate: '2026-03-21T00:00:00.000Z',
        status: 'POSTED',
        sourceKind: 'MANUAL_ADJUSTMENT',
        memo: 'Corrected fuel amount',
        sourceCollectedTransactionId: null,
        sourceCollectedTransactionTitle: null,
        reversesJournalEntryId: null,
        reversesJournalEntryNumber: null,
        reversedByJournalEntryId: null,
        reversedByJournalEntryNumber: null,
        correctsJournalEntryId: 'je-seed-1',
        correctsJournalEntryNumber: '202603-0003',
        correctionEntryIds: [],
        correctionEntryNumbers: [],
        correctionReason: 'Corrected fuel amount',
        createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
        createdByMembershipId: 'membership-1',
        lines: [
          {
            id: 'jel-seed-1-c1-1',
            lineNumber: 1,
            accountSubjectCode: '5100',
            accountSubjectName: '운영비용',
            fundingAccountName: null,
            debitAmount: 95_000,
            creditAmount: 0,
            description: 'Corrected fuel amount'
          },
          {
            id: 'jel-seed-1-c1-2',
            lineNumber: 2,
            accountSubjectCode: '1010',
            accountSubjectName: '현금및예금',
            fundingAccountName: 'Main checking',
            debitAmount: 0,
            creditAmount: 95_000,
            description: 'Corrected fuel amount'
          }
        ]
      },
      {
        id: 'je-seed-1',
        entryNumber: '202603-0003',
        entryDate: '2026-03-20T00:00:00.000Z',
        status: 'SUPERSEDED',
        sourceKind: 'COLLECTED_TRANSACTION',
        memo: 'Fuel refill',
        sourceCollectedTransactionId: 'ctx-seed-2',
        sourceCollectedTransactionTitle: 'Fuel refill',
        reversesJournalEntryId: null,
        reversesJournalEntryNumber: null,
        reversedByJournalEntryId: null,
        reversedByJournalEntryNumber: null,
        correctsJournalEntryId: null,
        correctsJournalEntryNumber: null,
        correctionEntryIds: ['je-seed-1-c1'],
        correctionEntryNumbers: ['202603-0004'],
        correctionReason: null,
        createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
        createdByMembershipId: 'membership-1',
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
