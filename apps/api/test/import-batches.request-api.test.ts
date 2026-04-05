import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  PlanItemStatus,
  TransactionType
} from '@prisma/client';
import { buildSourceFingerprint } from '../src/modules/import-batches/import-batch.policy';
import { createRequestTestContext } from './request-api.test-support';

test('GET /import-batches returns only the current workspace batches in reverse uploaded order', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.importBatches.push(
      {
        id: 'import-batch-older',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: null,
        sourceKind: ImportSourceKind.BANK_CSV,
        fileName: 'older-bank.csv',
        fileHash: 'hash-older',
        rowCount: 1,
        parseStatus: ImportBatchParseStatus.COMPLETED,
        uploadedByMembershipId: 'membership-1',
        uploadedAt: new Date('2026-03-02T00:00:00.000Z')
      },
      {
        id: 'import-batch-newer',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: null,
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        fileName: 'newer-manual.csv',
        fileHash: 'hash-newer',
        rowCount: 2,
        parseStatus: ImportBatchParseStatus.PARTIAL,
        uploadedByMembershipId: 'membership-1',
        uploadedAt: new Date('2026-03-10T00:00:00.000Z')
      },
      {
        id: 'import-batch-other',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        periodId: null,
        sourceKind: ImportSourceKind.BANK_CSV,
        fileName: 'other-tenant.csv',
        fileHash: 'hash-other',
        rowCount: 1,
        parseStatus: ImportBatchParseStatus.COMPLETED,
        uploadedByMembershipId: 'membership-2',
        uploadedAt: new Date('2026-03-11T00:00:00.000Z')
      }
    );
    context.state.importedRows.push(
      {
        id: 'imported-row-older-1',
        batchId: 'import-batch-older',
        rowNumber: 2,
        rawPayload: {
          original: {
            date: '2026-03-02',
            title: 'Fuel',
            amount: '84000'
          },
          parsed: {
            occurredOn: '2026-03-02',
            title: 'Fuel',
            amount: 84000
          }
        },
        parseStatus: ImportedRowParseStatus.PARSED,
        parseError: null,
        sourceFingerprint: null
      },
      {
        id: 'imported-row-newer-1',
        batchId: 'import-batch-newer',
        rowNumber: 2,
        rawPayload: {
          original: {
            date: '2026-03-10',
            title: 'Coffee',
            amount: '4800'
          },
          parsed: {
            occurredOn: '2026-03-10',
            title: 'Coffee',
            amount: 4800
          }
        },
        parseStatus: ImportedRowParseStatus.PARSED,
        parseError: null,
        sourceFingerprint: null
      },
      {
        id: 'imported-row-newer-2',
        batchId: 'import-batch-newer',
        rowNumber: 3,
        rawPayload: {
          original: {
            date: 'not-a-date',
            title: 'Broken',
            amount: '15000'
          },
          parsed: {
            occurredOn: null,
            title: 'Broken',
            amount: 15000
          }
        },
        parseStatus: ImportedRowParseStatus.FAILED,
        parseError: 'date 값이 올바르지 않습니다.',
        sourceFingerprint: null
      }
    );

    const response = await context.request('/import-batches', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'import-batch-newer',
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        fileName: 'newer-manual.csv',
        fileHash: 'hash-newer',
        rowCount: 2,
        parseStatus: ImportBatchParseStatus.PARTIAL,
        uploadedAt: '2026-03-10T00:00:00.000Z',
        parsedRowCount: 1,
        failedRowCount: 1,
        rows: [
          {
            id: 'imported-row-newer-1',
            rowNumber: 2,
            parseStatus: ImportedRowParseStatus.PARSED,
            parseError: null,
            sourceFingerprint: null,
            createdCollectedTransactionId: null,
            collectionSummary: null,
            rawPayload: {
              original: {
                date: '2026-03-10',
                title: 'Coffee',
                amount: '4800'
              },
              parsed: {
                occurredOn: '2026-03-10',
                title: 'Coffee',
                amount: 4800
              }
            }
          },
          {
            id: 'imported-row-newer-2',
            rowNumber: 3,
            parseStatus: ImportedRowParseStatus.FAILED,
            parseError: 'date 값이 올바르지 않습니다.',
            sourceFingerprint: null,
            createdCollectedTransactionId: null,
            collectionSummary: null,
            rawPayload: {
              original: {
                date: 'not-a-date',
                title: 'Broken',
                amount: '15000'
              },
              parsed: {
                occurredOn: null,
                title: 'Broken',
                amount: 15000
              }
            }
          }
        ]
      },
      {
        id: 'import-batch-older',
        sourceKind: ImportSourceKind.BANK_CSV,
        fileName: 'older-bank.csv',
        fileHash: 'hash-older',
        rowCount: 1,
        parseStatus: ImportBatchParseStatus.COMPLETED,
        uploadedAt: '2026-03-02T00:00:00.000Z',
        parsedRowCount: 1,
        failedRowCount: 0,
        rows: [
          {
            id: 'imported-row-older-1',
            rowNumber: 2,
            parseStatus: ImportedRowParseStatus.PARSED,
            parseError: null,
            sourceFingerprint: null,
            createdCollectedTransactionId: null,
            collectionSummary: null,
            rawPayload: {
              original: {
                date: '2026-03-02',
                title: 'Fuel',
                amount: '84000'
              },
              parsed: {
                occurredOn: '2026-03-02',
                title: 'Fuel',
                amount: 84000
              }
            }
          }
        ]
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /import-batches/:id returns the batch detail with imported rows', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.importBatches.push({
      id: 'import-batch-detail',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      sourceKind: ImportSourceKind.CARD_EXCEL,
      fileName: 'card-approval.tsv',
      fileHash: 'hash-card',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED,
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-15T09:00:00.000Z')
    });
    context.state.importedRows.push(
      {
        id: 'imported-row-detail-2',
        batchId: 'import-batch-detail',
        rowNumber: 3,
        rawPayload: {
          original: {
            approved_at: '2026-03-14',
            merchant: 'Stationery',
            amount: '12000'
          },
          parsed: {
            occurredOn: '2026-03-14',
            title: 'Stationery',
            amount: 12000
          }
        },
        parseStatus: ImportedRowParseStatus.PARSED,
        parseError: null,
        sourceFingerprint: null
      },
      {
        id: 'imported-row-detail-1',
        batchId: 'import-batch-detail',
        rowNumber: 2,
        rawPayload: {
          original: {
            approved_at: '2026-03-13',
            merchant: 'Cafe',
            amount: '5500'
          },
          parsed: {
            occurredOn: '2026-03-13',
            title: 'Cafe',
            amount: 5500
          }
        },
        parseStatus: ImportedRowParseStatus.PARSED,
        parseError: null,
        sourceFingerprint: null
      }
    );

    const response = await context.request(
      '/import-batches/import-batch-detail',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'import-batch-detail',
      sourceKind: ImportSourceKind.CARD_EXCEL,
      fileName: 'card-approval.tsv',
      fileHash: 'hash-card',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED,
      uploadedAt: '2026-03-15T09:00:00.000Z',
      parsedRowCount: 2,
      failedRowCount: 0,
      rows: [
        {
          id: 'imported-row-detail-1',
          rowNumber: 2,
          parseStatus: ImportedRowParseStatus.PARSED,
          parseError: null,
          sourceFingerprint: null,
          createdCollectedTransactionId: null,
          collectionSummary: null,
          rawPayload: {
            original: {
              approved_at: '2026-03-13',
              merchant: 'Cafe',
              amount: '5500'
            },
            parsed: {
              occurredOn: '2026-03-13',
              title: 'Cafe',
              amount: 5500
            }
          }
        },
        {
          id: 'imported-row-detail-2',
          rowNumber: 3,
          parseStatus: ImportedRowParseStatus.PARSED,
          parseError: null,
          sourceFingerprint: null,
          createdCollectedTransactionId: null,
          collectionSummary: null,
          rawPayload: {
            original: {
              approved_at: '2026-03-14',
              merchant: 'Stationery',
              amount: '12000'
            },
            parsed: {
              occurredOn: '2026-03-14',
              title: 'Stationery',
              amount: 12000
            }
          }
        }
      ]
    });
  } finally {
    await context.close();
  }
});

test('POST /import-batches creates an import batch and imported rows from UTF-8 text content', async () => {
  const context = await createRequestTestContext();

  try {
    const content = [
      'date,title,amount',
      '2026-03-02,Coffee,4800',
      '2026-03-03,Lunch,15000'
    ].join('\n');
    const expectedHash = createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
    const firstFingerprint = buildSourceFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-02',
      amount: 4800,
      description: 'Coffee',
      sourceOrigin: null
    });
    const secondFingerprint = buildSourceFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-03',
      amount: 15000,
      description: 'Lunch',
      sourceOrigin: null
    });

    const response = await context.request('/import-batches', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        fileName: 'march-manual.csv',
        content
      }
    });

    const created = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(created.id, 'import-batch-1');
    assert.equal(created.sourceKind, ImportSourceKind.MANUAL_UPLOAD);
    assert.equal(created.fileName, 'march-manual.csv');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
    assert.equal(created.parsedRowCount, 2);
    assert.equal(created.failedRowCount, 0);
    assert.equal(typeof created.uploadedAt, 'string');
    assert.deepEqual(created.rows, [
      {
        id: 'imported-row-1',
        rowNumber: 2,
        parseStatus: ImportedRowParseStatus.PARSED,
        parseError: null,
        sourceFingerprint: firstFingerprint,
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: {
            date: '2026-03-02',
            title: 'Coffee',
            amount: '4800'
          },
          parsed: {
            occurredOn: '2026-03-02',
            title: 'Coffee',
            amount: 4800
          }
        }
      },
      {
        id: 'imported-row-2',
        rowNumber: 3,
        parseStatus: ImportedRowParseStatus.PARSED,
        parseError: null,
        sourceFingerprint: secondFingerprint,
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: {
            date: '2026-03-03',
            title: 'Lunch',
            amount: '15000'
          },
          parsed: {
            occurredOn: '2026-03-03',
            title: 'Lunch',
            amount: 15000
          }
        }
      }
    ]);
    assert.equal(context.state.importBatches.length, 1);
    assert.equal(context.state.importedRows.length, 2);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'import_batch.upload' &&
          candidate.details.importBatchId === 'import-batch-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches returns 403 when the current membership role cannot upload batches', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';
    const response = await context.request('/import-batches', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        fileName: 'march-manual.csv',
        content: 'date,title,amount\n2026-03-02,Coffee,4800'
      }
    });

    assert.equal(response.status, 403);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'import_batch.upload' &&
          candidate.details.membershipRole === 'VIEWER'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect-preview returns the automatic preparation summary before promotion', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-import-collect',
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
    context.state.importBatches.push({
      id: 'import-batch-collect',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      fileName: 'collect-me.csv',
      fileHash: 'hash-collect',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED,
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    context.state.planItems.push({
      id: 'plan-item-collect-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-import-collect',
      recurringRuleId: null,
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      title: 'Coffee beans budget',
      plannedAmount: 19800,
      plannedDate: new Date('2026-03-11T00:00:00.000Z'),
      status: PlanItemStatus.DRAFT,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.importedRows.push({
      id: 'imported-row-collect-1',
      batchId: 'import-batch-collect',
      rowNumber: 2,
      rawPayload: {
        original: {
          date: '2026-03-12',
          title: 'Coffee beans',
          amount: '19800'
        },
        parsed: {
          occurredOn: '2026-03-12',
          title: 'Coffee beans',
          amount: 19800
        }
      },
      parseStatus: ImportedRowParseStatus.PARSED,
      parseError: null,
      sourceFingerprint: buildSourceFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 19800,
        description: 'Coffee beans',
        sourceOrigin: null
      })
    });

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect-preview',
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
      importedRowId: 'imported-row-collect-1',
      occurredOn: '2026-03-12',
      title: 'Coffee beans',
      amountWon: 19800,
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
    });
    assert.equal(context.state.collectedTransactions.length, 3);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect creates a collected transaction from a parsed imported row', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-import-collect',
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
    context.state.importBatches.push({
      id: 'import-batch-collect',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      fileName: 'collect-me.csv',
      fileHash: 'hash-collect',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED,
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    context.state.planItems.push({
      id: 'plan-item-collect-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-import-collect',
      recurringRuleId: null,
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      title: 'Coffee beans budget',
      plannedAmount: 19800,
      plannedDate: new Date('2026-03-11T00:00:00.000Z'),
      status: PlanItemStatus.DRAFT,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.importedRows.push({
      id: 'imported-row-collect-1',
      batchId: 'import-batch-collect',
      rowNumber: 2,
      rawPayload: {
        original: {
          date: '2026-03-12',
          title: 'Coffee beans',
          amount: '19800'
        },
        parsed: {
          occurredOn: '2026-03-12',
          title: 'Coffee beans',
          amount: 19800
        }
      },
      parseStatus: ImportedRowParseStatus.PARSED,
      parseError: null,
      sourceFingerprint: buildSourceFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 19800,
        description: 'Coffee beans',
        sourceOrigin: null
      })
    });

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
        amountWon: 19800,
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
        amountWon: 19800,
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
      sourceFingerprint: buildSourceFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 19800,
        description: 'Coffee beans',
        sourceOrigin: null
      }),
      title: 'Coffee beans',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 19800,
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

test('POST /import-batches/:id/rows/:rowId/collect returns 400 for a failed imported row', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.importBatches.push({
      id: 'import-batch-failed-row',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      sourceKind: ImportSourceKind.BANK_CSV,
      fileName: 'failed-row.csv',
      fileHash: 'hash-failed-row',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.FAILED,
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    context.state.importedRows.push({
      id: 'imported-row-failed-1',
      batchId: 'import-batch-failed-row',
      rowNumber: 2,
      rawPayload: {
        original: {
          date: 'not-a-date',
          title: 'Broken row',
          amount: '12000'
        },
        parsed: {
          occurredOn: null,
          title: 'Broken row',
          amount: 12000
        }
      },
      parseStatus: ImportedRowParseStatus.FAILED,
      parseError: 'date 값이 올바르지 않습니다.',
      sourceFingerprint: null
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

test('POST /import-batches/:id/rows/:rowId/collect keeps the transaction in collected status when a duplicate fingerprint already exists', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-duplicate-fingerprint',
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
    context.state.importBatches.push({
      id: 'import-batch-duplicate-fingerprint',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      fileName: 'duplicate-fingerprint.csv',
      fileHash: 'hash-duplicate-fingerprint',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED,
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    context.state.planItems.push({
      id: 'plan-item-duplicate-fingerprint',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-duplicate-fingerprint',
      recurringRuleId: null,
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      title: 'Lunch budget',
      plannedAmount: 12000,
      plannedDate: new Date('2026-03-12T00:00:00.000Z'),
      status: PlanItemStatus.DRAFT,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    const duplicateFingerprint = buildSourceFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-12',
      amount: 12000,
      description: 'Lunch',
      sourceOrigin: null
    });
    context.state.importedRows.push({
      id: 'imported-row-duplicate-fingerprint',
      batchId: 'import-batch-duplicate-fingerprint',
      rowNumber: 2,
      rawPayload: {
        original: {
          date: '2026-03-12',
          title: 'Lunch',
          amount: '12000'
        },
        parsed: {
          occurredOn: '2026-03-12',
          title: 'Lunch',
          amount: 12000
        }
      },
      parseStatus: ImportedRowParseStatus.PARSED,
      parseError: null,
      sourceFingerprint: duplicateFingerprint
    });
    context.state.collectedTransactions.push({
      id: 'ctx-existing-duplicate-fingerprint',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-duplicate-fingerprint',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: duplicateFingerprint,
      title: 'Existing lunch',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 12000,
      status: CollectedTransactionStatus.READY_TO_POST,
      memo: null,
      createdAt: new Date('2026-03-12T08:00:00.000Z'),
      updatedAt: new Date('2026-03-12T08:00:00.000Z')
    });

    const response = await context.request(
      '/import-batches/import-batch-duplicate-fingerprint/rows/imported-row-duplicate-fingerprint/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1'
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
    context.state.accountingPeriods.push({
      id: 'period-open-duplicate-collect',
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
    context.state.importBatches.push({
      id: 'import-batch-duplicate-collect',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      fileName: 'duplicate-collect.csv',
      fileHash: 'hash-duplicate-collect',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED,
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    context.state.importedRows.push({
      id: 'imported-row-duplicate-1',
      batchId: 'import-batch-duplicate-collect',
      rowNumber: 2,
      rawPayload: {
        original: {
          date: '2026-03-12',
          title: 'Lunch',
          amount: '12000'
        },
        parsed: {
          occurredOn: '2026-03-12',
          title: 'Lunch',
          amount: 12000
        }
      },
      parseStatus: ImportedRowParseStatus.PARSED,
      parseError: null,
      sourceFingerprint: 'sf:v1:duplicate'
    });
    context.state.collectedTransactions.push({
      id: 'ctx-imported-existing',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-duplicate-collect',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: 'import-batch-duplicate-collect',
      importedRowId: 'imported-row-duplicate-1',
      sourceFingerprint: 'sf:v1:duplicate',
      title: 'Lunch',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 12000,
      status: CollectedTransactionStatus.COLLECTED,
      memo: null,
      createdAt: new Date('2026-03-12T08:00:00.000Z'),
      updatedAt: new Date('2026-03-12T08:00:00.000Z')
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
    context.state.importBatches.push({
      id: 'import-batch-denied-collect',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      fileName: 'denied-collect.csv',
      fileHash: 'hash-denied-collect',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED,
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    context.state.importedRows.push({
      id: 'imported-row-denied-1',
      batchId: 'import-batch-denied-collect',
      rowNumber: 2,
      rawPayload: {
        original: {
          date: '2026-03-12',
          title: 'Coffee',
          amount: '4800'
        },
        parsed: {
          occurredOn: '2026-03-12',
          title: 'Coffee',
          amount: 4800
        }
      },
      parseStatus: ImportedRowParseStatus.PARSED,
      parseError: null,
      sourceFingerprint: buildSourceFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 4800,
        description: 'Coffee',
        sourceOrigin: null
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
