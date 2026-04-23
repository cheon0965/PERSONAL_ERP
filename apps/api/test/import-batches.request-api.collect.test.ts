import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  PlanItemStatus,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
import {
  buildImportRowFingerprint,
  pushCollectedTransaction,
  pushImportBatch,
  pushImportedRow,
  seedCollectableImportScenario
} from './import-batches.request-api.shared';

test('POST /import-batches/:id/rows/:rowId/collect creates a collected transaction from a parsed imported row', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context);

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Imported from upload'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      collectedTransaction: {
        id: 'ctx-4',
        businessDate: '2026-03-12',
        title: 'Coffee beans',
        type: TransactionType.EXPENSE,
        amountWon: 19_800,
        fundingAccountName: 'Main checking',
        categoryName: 'Fuel',
        sourceKind: 'IMPORT',
        postingStatus: 'READY_TO_POST',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null,
        matchedPlanItemId: 'plan-item-collect-1',
        matchedPlanItemTitle: 'Coffee beans budget'
      },
      preview: {
        importedRowId: 'imported-row-collect-1',
        occurredOn: '2026-03-12',
        title: 'Coffee beans',
        amountWon: 19_800,
        fundingAccountId: 'acc-1',
        fundingAccountName: 'Main checking',
        type: TransactionType.EXPENSE,
        requestedCategoryId: null,
        requestedCategoryName: null,
        autoPreparation: {
          matchedPlanItemId: 'plan-item-collect-1',
          matchedPlanItemTitle: 'Coffee beans budget',
          effectiveCategoryId: 'cat-1',
          effectiveCategoryName: 'Fuel',
          nextWorkflowStatus: 'READY_TO_POST',
          hasDuplicateSourceFingerprint: false,
          allowPlanItemMatch: true,
          decisionReasons: [
            '계획 항목 "Coffee beans budget"과 연결합니다.',
            '계획 항목 기준으로 "Fuel" 카테고리를 보완합니다.',
            '즉시 전표 준비 상태로 올립니다.'
          ]
        }
      }
    });
    assert.equal(context.state.collectedTransactions.length, 4);
    assert.deepEqual(context.state.collectedTransactions.at(-1), {
      id: 'ctx-4',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-import-collect',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: 'plan-item-collect-1',
      importBatchId: 'import-batch-collect',
      importedRowId: 'imported-row-collect-1',
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 19_800,
        title: 'Coffee beans'
      }),
      title: 'Coffee beans',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 19_800,
      status: CollectedTransactionStatus.READY_TO_POST,
      memo: 'Imported from upload',
      createdAt: context.state.collectedTransactions.at(-1)?.createdAt,
      updatedAt: context.state.collectedTransactions.at(-1)?.updatedAt
    });
    assert.equal(
      context.state.planItems.find(
        (candidate) => candidate.id === 'plan-item-collect-1'
      )?.status,
      PlanItemStatus.MATCHED
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.importBatchId === 'import-batch-collect' &&
          candidate.details.importedRowId === 'imported-row-collect-1' &&
          candidate.details.collectedTransactionId === 'ctx-4'
      )
    );
  } finally {
    await context.close();
  }
});

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
    assert.deepEqual(context.state.openingBalanceSnapshots, [
      {
        id: 'opening-snapshot-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        effectivePeriodId: 'period-1',
        sourceKind: 'INITIAL_SETUP',
        createdAt: context.state.openingBalanceSnapshots[0]?.createdAt,
        createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
        createdByMembershipId: 'membership-1'
      }
    ]);
    assert.deepEqual(context.state.balanceSnapshotLines, [
      {
        id: 'balance-snapshot-line-1',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-snapshot-1',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 250_000
      }
    ]);
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
    const createdPeriodId = context.state.accountingPeriods.at(-1)?.id;
    assert.deepEqual(context.state.openingBalanceSnapshots, [
      {
        id: 'opening-snapshot-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        effectivePeriodId: createdPeriodId,
        sourceKind: 'INITIAL_SETUP',
        createdAt: context.state.openingBalanceSnapshots[0]?.createdAt,
        createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
        createdByMembershipId: 'membership-1'
      }
    ]);
    assert.deepEqual(context.state.balanceSnapshotLines, [
      {
        id: 'balance-snapshot-line-1',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-snapshot-1',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-2100',
        fundingAccountId: 'acc-new-card-bootstrap',
        balanceAmount: 50_000
      }
    ]);
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

test('POST /import-batches/:id/rows/:rowId/collect absorbs a recurring collected transaction that was already created from a matched plan item', async () => {
  const context = await createRequestTestContext();

  try {
    const seeded = seedCollectableImportScenario(context, {
      periodId: 'period-open-recurring-absorb',
      batchId: 'import-batch-recurring-absorb',
      rowId: 'imported-row-recurring-absorb',
      planItemId: 'plan-item-recurring-absorb',
      title: 'Phone bill',
      amount: 75_000,
      planItemTitle: 'Phone bill'
    });

    context.state.planItems = context.state.planItems.map((candidate) =>
      candidate.id === seeded.planItem.id
        ? {
            ...candidate,
            status: PlanItemStatus.MATCHED,
            updatedAt: new Date()
          }
        : candidate
    );

    pushCollectedTransaction(context, {
      id: 'ctx-recurring-existing',
      periodId: seeded.period.id,
      matchedPlanItemId: seeded.planItem.id,
      title: 'Phone bill',
      amount: 75_000,
      occurredOn: new Date('2026-03-11T00:00:00.000Z'),
      status: CollectedTransactionStatus.READY_TO_POST
    });

    const response = await context.request(
      '/import-batches/import-batch-recurring-absorb/rows/imported-row-recurring-absorb/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Imported recurring bill'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(
      (response.body as { collectedTransaction: { id: string } })
        .collectedTransaction.id,
      'ctx-recurring-existing'
    );
    assert.equal(
      context.state.collectedTransactions.filter(
        (candidate) => candidate.matchedPlanItemId === seeded.planItem.id
      ).length,
      1
    );
    assert.deepEqual(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-recurring-existing'
      ),
      {
        id: 'ctx-recurring-existing',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: seeded.period.id,
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: seeded.planItem.id,
        importBatchId: seeded.batch.id,
        importedRowId: seeded.row.id,
        sourceFingerprint: seeded.fingerprint,
        title: 'Phone bill',
        occurredOn: new Date('2026-03-12T00:00:00.000Z'),
        amount: 75_000,
        status: CollectedTransactionStatus.READY_TO_POST,
        memo: 'Imported recurring bill',
        createdAt: context.state.collectedTransactions.find(
          (candidate) => candidate.id === 'ctx-recurring-existing'
        )?.createdAt,
        updatedAt: context.state.collectedTransactions.find(
          (candidate) => candidate.id === 'ctx-recurring-existing'
        )?.updatedAt
      }
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 409 when the matched recurring transaction is already linked to another import row', async () => {
  const context = await createRequestTestContext();

  try {
    const seeded = seedCollectableImportScenario(context, {
      periodId: 'period-open-recurring-conflict',
      batchId: 'import-batch-recurring-conflict',
      rowId: 'imported-row-recurring-conflict',
      planItemId: 'plan-item-recurring-conflict',
      title: 'Streaming bill',
      amount: 21_000,
      planItemTitle: 'Streaming bill'
    });

    context.state.planItems = context.state.planItems.map((candidate) =>
      candidate.id === seeded.planItem.id
        ? {
            ...candidate,
            status: PlanItemStatus.MATCHED,
            updatedAt: new Date()
          }
        : candidate
    );

    pushCollectedTransaction(context, {
      id: 'ctx-recurring-conflict',
      periodId: seeded.period.id,
      matchedPlanItemId: seeded.planItem.id,
      title: 'Streaming bill',
      amount: 21_000,
      occurredOn: new Date('2026-03-11T00:00:00.000Z'),
      status: CollectedTransactionStatus.READY_TO_POST
    });
    context.state.simulateCollectedTransactionAlreadyLinkedOnNextImportClaimId =
      'ctx-recurring-conflict';

    const response = await context.request(
      '/import-batches/import-batch-recurring-conflict/rows/imported-row-recurring-conflict/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Retry imported recurring bill'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message:
        '이미 다른 업로드 행과 연결된 반복 수집 거래입니다. 다시 새로고침해 주세요.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.collectedTransactions.filter(
        (candidate) => candidate.matchedPlanItemId === seeded.planItem.id
      ).length,
      1
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 400 for a failed imported row', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-failed-row',
      sourceKind: ImportSourceKind.BANK_CSV,
      fileName: 'failed-row.csv',
      fileHash: 'hash-failed-row',
      parseStatus: ImportBatchParseStatus.FAILED
    });
    pushImportedRow(context, {
      id: 'imported-row-failed-1',
      batchId: 'import-batch-failed-row',
      title: 'Broken row',
      amount: 12_000,
      parseStatus: ImportedRowParseStatus.FAILED
    });

    const response = await context.request(
      '/import-batches/import-batch-failed-row/rows/imported-row-failed-1/collect',
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
      message: '파싱 완료 행만 수집 거래로 승격할 수 있습니다.',
      error: 'Bad Request'
    });
    assert.equal(context.state.collectedTransactions.length, 3);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 400 for a locked target month', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-locked-period',
      fileName: 'locked-period.csv',
      fileHash: 'hash-locked-period'
    });
    pushImportedRow(context, {
      id: 'imported-row-locked-period',
      batchId: 'import-batch-locked-period',
      occurredOn: '2026-02-12',
      title: 'Locked month row',
      amount: 14_000
    });
    context.state.accountingPeriods.push({
      id: 'period-locked-2026-02',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      status: 'LOCKED',
      nextJournalEntrySequence: 1,
      openedAt: new Date('2026-02-01T00:00:00.000Z'),
      lockedAt: new Date('2026-02-28T23:59:59.000Z'),
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-28T23:59:59.000Z')
    });

    const response = await context.request(
      '/import-batches/import-batch-locked-period/rows/imported-row-locked-period/collect',
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
      message: '2026-02 마감월 데이터이기 때문에 저장할 수 없습니다.',
      error: 'Bad Request'
    });
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect requires confirmation when a potential duplicate transaction exists', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      title: 'Fuel refill',
      amount: 84_000
    });
    pushCollectedTransaction(context, {
      id: 'ctx-potential-duplicate-collect',
      periodId: 'period-open-import-collect',
      title: 'Fuel refill existing',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 84_000
    });

    const blockedResponse = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
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

    assert.equal(blockedResponse.status, 409);
    assert.deepEqual(blockedResponse.body, {
      statusCode: 409,
      message:
        '같은 거래일·금액·입출금 유형의 기존 거래 1건이 있어 확인 없이 저장할 수 없습니다. 자동 판정 요약을 확인한 뒤 다시 등록해 주세요.',
      error: 'Conflict'
    });
    assert.equal(context.state.collectedTransactions.length, 4);

    const confirmedResponse = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1',
          confirmPotentialDuplicate: true
        }
      }
    );

    assert.equal(confirmedResponse.status, 201);
    assert.equal(context.state.collectedTransactions.length, 5);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect ignores duplicate candidates from the same import batch', async () => {
  const context = await createRequestTestContext();

  try {
    const duplicateFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-12',
      amount: 84_000,
      title: 'Fuel refill'
    });

    seedCollectableImportScenario(context, {
      title: 'Fuel refill',
      amount: 84_000,
      sourceFingerprint: duplicateFingerprint
    });
    pushCollectedTransaction(context, {
      id: 'ctx-same-batch-potential-duplicate-collect',
      periodId: 'period-open-import-collect',
      importBatchId: 'import-batch-collect',
      importedRowId: 'imported-row-same-batch-existing',
      sourceFingerprint: duplicateFingerprint,
      title: 'Fuel refill existing from same batch',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 84_000
    });

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
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
    assert.equal(
      (
        response.body as {
          preview: {
            autoPreparation: {
              hasDuplicateSourceFingerprint: boolean;
              potentialDuplicateTransactionCount?: number;
            };
          };
        }
      ).preview.autoPreparation.hasDuplicateSourceFingerprint,
      false
    );
    assert.equal(
      (
        response.body as {
          preview: {
            autoPreparation: {
              potentialDuplicateTransactionCount?: number;
            };
          };
        }
      ).preview.autoPreparation.potentialDuplicateTransactionCount,
      undefined
    );
    assert.equal(
      context.state.collectedTransactions.at(-1)?.status,
      CollectedTransactionStatus.READY_TO_POST
    );
    assert.equal(
      context.state.collectedTransactions.at(-1)?.matchedPlanItemId,
      'plan-item-collect-1'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect still requires confirmation for duplicate candidates from another import batch', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      title: 'Fuel refill',
      amount: 84_000
    });
    pushCollectedTransaction(context, {
      id: 'ctx-other-batch-potential-duplicate-collect',
      periodId: 'period-open-import-collect',
      importBatchId: 'import-batch-earlier-upload',
      importedRowId: 'imported-row-earlier-upload',
      title: 'Fuel refill from earlier upload',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 84_000
    });

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
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

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message: string }).message,
      '같은 거래일·금액·입출금 유형의 기존 거래 1건이 있어 확인 없이 저장할 수 없습니다. 자동 판정 요약을 확인한 뒤 다시 등록해 주세요.'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect keeps the transaction in collected status when a duplicate fingerprint already exists', async () => {
  const context = await createRequestTestContext();

  try {
    const duplicateFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-12',
      amount: 12_000,
      title: 'Lunch'
    });

    seedCollectableImportScenario(context, {
      periodId: 'period-open-duplicate-fingerprint',
      batchId: 'import-batch-duplicate-fingerprint',
      rowId: 'imported-row-duplicate-fingerprint',
      planItemId: 'plan-item-duplicate-fingerprint',
      title: 'Lunch',
      amount: 12_000,
      fileName: 'duplicate-fingerprint.csv',
      fileHash: 'hash-duplicate-fingerprint',
      planItemTitle: 'Lunch budget',
      sourceFingerprint: duplicateFingerprint
    });
    pushCollectedTransaction(context, {
      id: 'ctx-existing-duplicate-fingerprint',
      periodId: 'period-open-duplicate-fingerprint',
      sourceFingerprint: duplicateFingerprint,
      title: 'Existing lunch'
    });

    const response = await context.request(
      '/import-batches/import-batch-duplicate-fingerprint/rows/imported-row-duplicate-fingerprint/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          confirmPotentialDuplicate: true
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(
      context.state.collectedTransactions.at(-1)?.status,
      CollectedTransactionStatus.COLLECTED
    );
    assert.equal(
      context.state.collectedTransactions.at(-1)?.matchedPlanItemId,
      null
    );
    assert.equal(
      context.state.collectedTransactions.at(-1)?.categoryId,
      'cat-1'
    );
    assert.equal(
      context.state.planItems.find(
        (candidate) => candidate.id === 'plan-item-duplicate-fingerprint'
      )?.status,
      PlanItemStatus.DRAFT
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 409 when the imported row is already promoted', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      periodId: 'period-open-duplicate-collect',
      batchId: 'import-batch-duplicate-collect',
      rowId: 'imported-row-duplicate-1',
      title: 'Lunch',
      amount: 12_000,
      sourceFingerprint: 'sf:v1:duplicate',
      fileName: 'duplicate-collect.csv',
      fileHash: 'hash-duplicate-collect'
    });
    pushCollectedTransaction(context, {
      id: 'ctx-imported-existing',
      periodId: 'period-open-duplicate-collect',
      importBatchId: 'import-batch-duplicate-collect',
      importedRowId: 'imported-row-duplicate-1',
      sourceFingerprint: 'sf:v1:duplicate',
      title: 'Lunch',
      status: CollectedTransactionStatus.COLLECTED
    });

    const response = await context.request(
      '/import-batches/import-batch-duplicate-collect/rows/imported-row-duplicate-1/collect',
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

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message: '이미 수집 거래로 승격된 업로드 행입니다.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.collectedTransactions.filter(
        (candidate) => candidate.importedRowId === 'imported-row-duplicate-1'
      ).length,
      1
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 403 when the current membership role cannot create collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';
    pushImportBatch(context, {
      id: 'import-batch-denied-collect',
      fileName: 'denied-collect.csv',
      fileHash: 'hash-denied-collect'
    });
    pushImportedRow(context, {
      id: 'imported-row-denied-1',
      batchId: 'import-batch-denied-collect',
      title: 'Coffee',
      amount: 4_800,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 4_800,
        title: 'Coffee'
      })
    });

    const response = await context.request(
      '/import-batches/import-batch-denied-collect/rows/imported-row-denied-1/collect',
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

    assert.equal(response.status, 403);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.importBatchId === 'import-batch-denied-collect' &&
          candidate.details.importedRowId === 'imported-row-denied-1' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});
