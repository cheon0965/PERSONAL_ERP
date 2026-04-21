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

test('POST /collected-transactions/confirm-bulk confirms selected ready transactions and skips non-ready rows', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-confirm-bulk',
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

    context.state.collectedTransactions.push(
      {
        id: 'ctx-confirm-bulk-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-open-confirm-bulk',
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: null,
        importBatchId: 'import-batch-bulk-confirm',
        importedRowId: null,
        sourceFingerprint: null,
        title: 'Bulk fuel refill',
        occurredOn: new Date('2026-03-03T00:00:00.000Z'),
        amount: 84_000,
        status: CollectedTransactionStatus.READY_TO_POST,
        memo: null,
        createdAt: new Date('2026-03-03T08:00:00.000Z'),
        updatedAt: new Date('2026-03-03T08:00:00.000Z')
      },
      {
        id: 'ctx-confirm-bulk-2',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-open-confirm-bulk',
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: null,
        importBatchId: 'import-batch-bulk-confirm',
        importedRowId: null,
        sourceFingerprint: null,
        title: 'Bulk supplies',
        occurredOn: new Date('2026-03-04T00:00:00.000Z'),
        amount: 42_000,
        status: CollectedTransactionStatus.READY_TO_POST,
        memo: null,
        createdAt: new Date('2026-03-04T08:00:00.000Z'),
        updatedAt: new Date('2026-03-04T08:00:00.000Z')
      },
      {
        id: 'ctx-confirm-bulk-reviewed',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-open-confirm-bulk',
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: null,
        matchedPlanItemId: null,
        importBatchId: 'import-batch-bulk-confirm',
        importedRowId: null,
        sourceFingerprint: null,
        title: 'Bulk needs review',
        occurredOn: new Date('2026-03-05T00:00:00.000Z'),
        amount: 12_000,
        status: CollectedTransactionStatus.REVIEWED,
        memo: null,
        createdAt: new Date('2026-03-05T08:00:00.000Z'),
        updatedAt: new Date('2026-03-05T08:00:00.000Z')
      }
    );

    const response = await context.request(
      '/collected-transactions/confirm-bulk',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          transactionIds: [
            'ctx-confirm-bulk-1',
            'ctx-confirm-bulk-2',
            'ctx-confirm-bulk-reviewed'
          ]
        }
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      requestedCount: 3,
      processedCount: 3,
      succeededCount: 2,
      skippedCount: 1,
      failedCount: 0,
      results: [
        {
          collectedTransactionId: 'ctx-confirm-bulk-1',
          status: 'CONFIRMED',
          journalEntryId: 'je-1',
          journalEntryNumber: '202603-0001',
          message: '202603-0001 전표를 생성했습니다.'
        },
        {
          collectedTransactionId: 'ctx-confirm-bulk-2',
          status: 'CONFIRMED',
          journalEntryId: 'je-2',
          journalEntryNumber: '202603-0002',
          message: '202603-0002 전표를 생성했습니다.'
        },
        {
          collectedTransactionId: 'ctx-confirm-bulk-reviewed',
          status: 'SKIPPED',
          journalEntryId: null,
          journalEntryNumber: null,
          message:
            '전표 준비 상태가 아니거나 현재 작업공간의 수집 거래가 아닙니다.'
        }
      ]
    });
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-confirm-bulk-1'
      )?.status,
      CollectedTransactionStatus.POSTED
    );
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-confirm-bulk-2'
      )?.status,
      CollectedTransactionStatus.POSTED
    );
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-confirm-bulk-reviewed'
      )?.status,
      CollectedTransactionStatus.REVIEWED
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.confirm_bulk' &&
          candidate.details.requestedCount === 3 &&
          candidate.details.succeededCount === 2
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

test('POST /collected-transactions/:id/confirm posts 승인취소 imports as 취소전표 and reverses the original journal entry', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-confirm-reversal',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 4,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-05-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      nextJournalEntrySequence: 8,
      openedAt: new Date('2026-04-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });

    context.state.importBatches.push({
      id: 'import-batch-confirm-reversal',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-confirm-reversal',
      sourceKind: 'IM_BANK_PDF',
      fileName: '거래내역조회.pdf',
      fileHash: 'hash-confirm-reversal',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: 'COMPLETED',
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-04-19T12:00:00.000Z')
    });

    context.state.importedRows.push(
      {
        id: 'imported-row-confirm-reversal-source',
        batchId: 'import-batch-confirm-reversal',
        rowNumber: 3,
        rawPayload: {
          parsed: {
            occurredOn: '2026-04-18',
            title: '기분좋은self주유',
            amount: 140000,
            direction: 'WITHDRAWAL',
            directionLabel: '출금',
            collectTypeHint: 'EXPENSE',
            balanceAfter: 860000,
            reversalTargetRowNumber: null
          }
        },
        parseStatus: 'PARSED',
        parseError: null,
        sourceFingerprint: 'sf:v1:confirm-reversal-source'
      },
      {
        id: 'imported-row-confirm-reversal-cancel',
        batchId: 'import-batch-confirm-reversal',
        rowNumber: 5,
        rawPayload: {
          parsed: {
            occurredOn: '2026-04-19',
            title: '기분좋은self주유',
            amount: 140000,
            direction: 'REVERSAL',
            directionLabel: '승인취소',
            collectTypeHint: 'REVERSAL',
            balanceAfter: 1000000,
            reversalTargetRowNumber: 3
          }
        },
        parseStatus: 'PARSED',
        parseError: null,
        sourceFingerprint: 'sf:v1:confirm-reversal-cancel'
      }
    );

    context.state.collectedTransactions.push(
      {
        id: 'ctx-confirm-reversal-source',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-open-confirm-reversal',
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: null,
        importBatchId: 'import-batch-confirm-reversal',
        importedRowId: 'imported-row-confirm-reversal-source',
        sourceFingerprint: 'sf:v1:confirm-reversal-source',
        title: '기분좋은self주유',
        occurredOn: new Date('2026-04-18T00:00:00.000Z'),
        amount: 140000,
        status: CollectedTransactionStatus.POSTED,
        memo: null,
        createdAt: new Date('2026-04-18T09:00:00.000Z'),
        updatedAt: new Date('2026-04-18T09:00:00.000Z')
      },
      {
        id: 'ctx-confirm-reversal-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-open-confirm-reversal',
        ledgerTransactionTypeId: 'ltt-1-adjustment',
        fundingAccountId: 'acc-1',
        categoryId: null,
        matchedPlanItemId: null,
        importBatchId: 'import-batch-confirm-reversal',
        importedRowId: 'imported-row-confirm-reversal-cancel',
        sourceFingerprint: 'sf:v1:confirm-reversal-cancel',
        title: '기분좋은self주유',
        occurredOn: new Date('2026-04-19T00:00:00.000Z'),
        amount: 140000,
        status: CollectedTransactionStatus.READY_TO_POST,
        memo: null,
        createdAt: new Date('2026-04-19T09:00:00.000Z'),
        updatedAt: new Date('2026-04-19T09:00:00.000Z')
      }
    );

    context.state.journalEntries.push({
      id: 'je-confirm-reversal-source-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-confirm-reversal',
      entryNumber: '202604-0007',
      entryDate: new Date('2026-04-18T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-confirm-reversal-source',
      reversesJournalEntryId: null,
      correctsJournalEntryId: null,
      correctionReason: null,
      status: 'POSTED',
      memo: '기분좋은self주유',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-04-18T09:05:00.000Z'),
      updatedAt: new Date('2026-04-18T09:05:00.000Z'),
      lines: [
        {
          id: 'jel-confirm-reversal-source-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 140000,
          creditAmount: 0,
          description: '기분좋은self주유'
        },
        {
          id: 'jel-confirm-reversal-source-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 140000,
          description: '기분좋은self주유'
        }
      ]
    });

    const response = await context.request(
      '/collected-transactions/ctx-confirm-reversal-1/confirm',
      {
        method: 'POST',
        headers: context.authHeaders()
      }
    );

    const body = response.body as Record<string, unknown>;
    const createdJournalEntry = context.state.journalEntries.find(
      (candidate) => candidate.id === 'je-2'
    );

    assert.equal(response.status, 201);
    assert.equal(body.id, 'je-2');
    assert.equal(body.entryNumber, '202604-0008');
    assert.equal(body.sourceKind, 'MANUAL_ADJUSTMENT');
    assert.equal(body.memo, '기분좋은self주유 승인취소');
    assert.equal(body.sourceCollectedTransactionId, 'ctx-confirm-reversal-1');
    assert.equal(body.sourceCollectedTransactionTitle, '기분좋은self주유');
    assert.equal(body.reversesJournalEntryId, 'je-confirm-reversal-source-1');
    assert.equal(body.reversesJournalEntryNumber, '202604-0007');
    assert.equal(body.correctsJournalEntryId, null);
    assert.equal(body.correctionReason, null);

    assert.deepEqual(
      createdJournalEntry?.lines.map((line) => ({
        lineNumber: line.lineNumber,
        accountSubjectId: line.accountSubjectId,
        fundingAccountId: line.fundingAccountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount
      })),
      [
        {
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 0,
          creditAmount: 140000
        },
        {
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 140000,
          creditAmount: 0
        }
      ]
    );

    assert.equal(
      context.state.journalEntries.find(
        (candidate) => candidate.id === 'je-confirm-reversal-source-1'
      )?.status,
      'REVERSED'
    );
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-confirm-reversal-source'
      )?.status,
      CollectedTransactionStatus.CORRECTED
    );
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-confirm-reversal-1'
      )?.status,
      CollectedTransactionStatus.POSTED
    );

    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.confirm' &&
          candidate.details.collectedTransactionId ===
            'ctx-confirm-reversal-1' &&
          candidate.details.journalEntryId === 'je-2'
      )
    );
  } finally {
    await context.close();
  }
});
