import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  ImportSourceKind,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  pushImportBatch,
  pushImportedRow,
  seedCollectableImportScenario
} from './shared';

test('POST /import-batches/:id/rows/:rowId/collect auto-creates the target operating month before saving', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-auto-period-collect',
      fileName: 'auto-period-collect.csv',
      fileHash: 'hash-auto-period-collect'
    });
    pushImportedRow(context, {
      id: 'imported-row-auto-period-collect',
      batchId: 'import-batch-auto-period-collect',
      occurredOn: '2026-02-12',
      title: 'Auto-open collect',
      amount: 22_000,
      parsed: {
        occurredOn: '2026-02-12',
        title: 'Auto-open collect',
        amount: 22_000,
        signedAmount: -22_000,
        balanceAfter: 228_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-auto-period-collect/rows/imported-row-auto-period-collect/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(context.state.accountingPeriods.length, 1);
    assert.deepEqual(context.state.accountingPeriods[0], {
      id: 'period-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      status: 'OPEN',
      nextJournalEntrySequence: 1,
      openedAt: context.state.accountingPeriods[0]?.openedAt,
      lockedAt: null,
      createdAt: context.state.accountingPeriods[0]?.createdAt,
      updatedAt: context.state.accountingPeriods[0]?.updatedAt
    });
    assert.equal(
      context.state.collectedTransactions.at(-1)?.periodId,
      'period-1'
    );
    assert.deepEqual(context.state.openingBalanceSnapshots, []);
    assert.deepEqual(context.state.balanceSnapshotLines, []);
    assert.ok(
      context.state.periodStatusHistory.some(
        (candidate) =>
          candidate.periodId === 'period-1' &&
          candidate.eventType === 'OPEN' &&
          candidate.reason === '업로드 배치 거래 등록 자동 생성 (2026-02)'
      )
    );
    assert.ok(
      (
        response.body as {
          preview: {
            autoPreparation: {
              decisionReasons: string[];
            };
          };
        }
      ).preview.autoPreparation.decisionReasons.includes(
        '2026-02 운영월이 없어 등록 과정에서 자동으로 추가합니다.'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect blocks automatic month creation during monthly operation', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      periodId: 'period-current-month-import-collect',
      batchId: 'import-batch-monthly-guard',
      rowId: 'imported-row-monthly-guard',
      occurredOn: '2026-02-12',
      title: 'Past month upload',
      amount: 22_000
    });

    const response = await context.request(
      '/import-batches/import-batch-monthly-guard/rows/imported-row-monthly-guard/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message:
        '2026-02 운영월은 업로드 배치에서 자동으로 추가할 수 없습니다. 운영 중에는 월 운영 화면에서 최신 진행월을 먼저 열고 해당 월 거래만 등록해 주세요.',
      error: 'Bad Request'
    });
    assert.equal(context.state.accountingPeriods.length, 1);
    assert.equal(context.state.collectedTransactions.length, 3);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect can create the next month for a new account/card bootstrap after the latest month is locked', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-new-card-bootstrap',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'New card',
      normalizedName: 'new card',
      type: 'CARD',
      balanceWon: 0,
      sortOrder: 10,
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING'
    });
    context.state.accountingPeriods.push({
      id: 'period-locked-before-new-card',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      nextJournalEntrySequence: 1,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z')
    });
    pushImportBatch(context, {
      id: 'import-batch-new-card-bootstrap',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'new-card-bootstrap.pdf',
      fileHash: 'hash-new-card-bootstrap',
      fundingAccountId: 'acc-new-card-bootstrap'
    });
    pushImportedRow(context, {
      id: 'imported-row-new-card-bootstrap',
      batchId: 'import-batch-new-card-bootstrap',
      occurredOn: '2026-04-02',
      title: 'New card opening purchase',
      amount: 33_000,
      parsed: {
        occurredOn: '2026-04-02',
        title: 'New card opening purchase',
        amount: 33_000,
        signedAmount: 33_000,
        balanceAfter: 83_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-new-card-bootstrap/rows/imported-row-new-card-bootstrap/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-new-card-bootstrap',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(
      {
        willCreateTargetPeriod: (
          response.body as {
            preview: {
              autoPreparation: {
                willCreateTargetPeriod?: boolean;
                targetPeriodMonthLabel?: string;
                targetPeriodCreationReason?: string;
              };
            };
          }
        ).preview.autoPreparation.willCreateTargetPeriod,
        targetPeriodMonthLabel: (
          response.body as {
            preview: {
              autoPreparation: {
                willCreateTargetPeriod?: boolean;
                targetPeriodMonthLabel?: string;
                targetPeriodCreationReason?: string;
              };
            };
          }
        ).preview.autoPreparation.targetPeriodMonthLabel,
        targetPeriodCreationReason: (
          response.body as {
            preview: {
              autoPreparation: {
                willCreateTargetPeriod?: boolean;
                targetPeriodMonthLabel?: string;
                targetPeriodCreationReason?: string;
              };
            };
          }
        ).preview.autoPreparation.targetPeriodCreationReason
      },
      {
        willCreateTargetPeriod: true,
        targetPeriodMonthLabel: '2026-04',
        targetPeriodCreationReason: 'NEW_FUNDING_ACCOUNT'
      }
    );
    assert.equal(context.state.accountingPeriods.length, 2);
    assert.equal(context.state.accountingPeriods.at(-1)?.year, 2026);
    assert.equal(context.state.accountingPeriods.at(-1)?.month, 4);
    assert.equal(
      context.state.collectedTransactions.at(-1)?.fundingAccountId,
      'acc-new-card-bootstrap'
    );
    assert.deepEqual(context.state.openingBalanceSnapshots, []);
    assert.deepEqual(context.state.balanceSnapshotLines, []);
    assert.equal(
      context.state.accounts.find(
        (candidate) => candidate.id === 'acc-new-card-bootstrap'
      )?.bootstrapStatus,
      'COMPLETED'
    );
    assert.ok(
      context.state.periodStatusHistory.some(
        (candidate) =>
          candidate.periodId === context.state.accountingPeriods.at(-1)?.id &&
          candidate.reason === '신규 계좌/카드 기초 업로드 자동 생성 (2026-04)'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect rejects new account bootstrap when accounting artifacts already exist', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-card-with-history',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'History card',
      normalizedName: 'history card',
      type: 'CARD',
      balanceWon: 0,
      sortOrder: 11,
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING'
    });
    context.state.accountingPeriods.push({
      id: 'period-locked-before-history-card',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      nextJournalEntrySequence: 1,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.journalEntries.push({
      id: 'je-card-history',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-locked-before-history-card',
      entryNumber: '202603-0099',
      entryDate: new Date('2026-03-15T00:00:00.000Z'),
      sourceKind: 'MANUAL_ADJUSTMENT',
      sourceCollectedTransactionId: null,
      status: 'POSTED',
      memo: 'Existing card history',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-15T01:00:00.000Z'),
      updatedAt: new Date('2026-03-15T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-card-history-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: 'acc-card-with-history',
          debitAmount: 10_000,
          creditAmount: 0,
          description: 'Existing card history'
        }
      ]
    });
    pushImportBatch(context, {
      id: 'import-batch-card-history',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'card-history.pdf',
      fileHash: 'hash-card-history',
      fundingAccountId: 'acc-card-with-history'
    });
    pushImportedRow(context, {
      id: 'imported-row-card-history',
      batchId: 'import-batch-card-history',
      occurredOn: '2026-04-02',
      title: 'History card purchase',
      amount: 44_000
    });

    const response = await context.request(
      '/import-batches/import-batch-card-history/rows/imported-row-card-history/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-card-with-history',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 400);
    assert.equal(
      (response.body as { message: string }).message,
      '2026-04 운영월은 업로드 배치에서 자동으로 추가할 수 없습니다. 운영 중에는 월 운영 화면에서 최신 진행월을 먼저 열고 해당 월 거래만 등록해 주세요.'
    );
    assert.equal(context.state.accountingPeriods.length, 1);
    assert.equal(
      context.state.accounts.find(
        (candidate) => candidate.id === 'acc-card-with-history'
      )?.bootstrapStatus,
      'PENDING'
    );
  } finally {
    await context.close();
  }
});
