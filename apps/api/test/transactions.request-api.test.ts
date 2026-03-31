import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
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

test('POST /collected-transactions returns 403 when the current membership role cannot create collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';
    const initialTransactionCount = context.state.collectedTransactions.length;
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

    assert.equal(response.status, 403);
    assert.equal(
      context.state.collectedTransactions.length,
      initialTransactionCount
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.membershipRole === 'VIEWER'
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
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.collectedTransactionId === 'ctx-4' &&
          candidate.details.periodId === 'period-open-created'
      )
    );
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
      importedRowId: null,
      sourceFingerprint: null,
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
      status: CollectedTransactionStatus.COLLECTED,
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
      status: CollectedTransactionStatus.COLLECTED,
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
    assert.equal(body.sourceKind, 'MANUAL_ADJUSTMENT');
    assert.equal(body.status, 'POSTED');
    assert.equal(body.memo, 'Reverse the March fuel entry.');
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
    assert.equal(body.sourceKind, 'MANUAL_ADJUSTMENT');
    assert.equal(body.status, 'POSTED');
    assert.equal(
      body.memo,
      'Adjust the posted amount after invoice verification.'
    );
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
