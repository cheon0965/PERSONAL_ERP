import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
import {
  pushImportBatch,
  pushImportedRow
} from './import-batches.request-api.shared';

test('GET /import-batches returns only the current workspace batches in reverse uploaded order', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-older',
      sourceKind: ImportSourceKind.BANK_CSV,
      fileName: 'older-bank.csv',
      fileHash: 'hash-older',
      uploadedAt: new Date('2026-03-02T00:00:00.000Z')
    });
    pushImportBatch(context, {
      id: 'import-batch-newer',
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      fileName: 'newer-manual.csv',
      fileHash: 'hash-newer',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.PARTIAL,
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    pushImportBatch(context, {
      id: 'import-batch-other',
      tenantId: 'tenant-2',
      ledgerId: 'ledger-2',
      sourceKind: ImportSourceKind.BANK_CSV,
      fileName: 'other-tenant.csv',
      fileHash: 'hash-other',
      uploadedByMembershipId: 'membership-2',
      uploadedAt: new Date('2026-03-11T00:00:00.000Z')
    });
    pushImportedRow(context, {
      id: 'imported-row-older-1',
      batchId: 'import-batch-older',
      occurredOn: '2026-03-02',
      title: 'Fuel',
      amount: 84_000
    });
    pushImportedRow(context, {
      id: 'imported-row-newer-1',
      batchId: 'import-batch-newer',
      occurredOn: '2026-03-10',
      title: 'Coffee',
      amount: 4_800
    });
    pushImportedRow(context, {
      id: 'imported-row-newer-2',
      batchId: 'import-batch-newer',
      rowNumber: 3,
      title: 'Broken',
      amount: 15_000,
      parseStatus: ImportedRowParseStatus.FAILED,
      original: {
        date: 'not-a-date',
        title: 'Broken',
        amount: '15000'
      },
      parsed: {
        occurredOn: null,
        title: 'Broken',
        amount: 15_000
      }
    });

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
                amount: 4_800
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
                amount: 15_000
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
                amount: 84_000
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
    pushImportBatch(context, {
      id: 'import-batch-detail',
      sourceKind: ImportSourceKind.CARD_EXCEL,
      fileName: 'card-approval.tsv',
      fileHash: 'hash-card',
      rowCount: 2,
      uploadedAt: new Date('2026-03-15T09:00:00.000Z')
    });
    pushImportedRow(context, {
      id: 'imported-row-detail-2',
      batchId: 'import-batch-detail',
      rowNumber: 3,
      original: {
        approved_at: '2026-03-14',
        merchant: 'Stationery',
        amount: '12000'
      },
      parsed: {
        occurredOn: '2026-03-14',
        title: 'Stationery',
        amount: 12_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-detail-1',
      batchId: 'import-batch-detail',
      original: {
        approved_at: '2026-03-13',
        merchant: 'Cafe',
        amount: '5500'
      },
      parsed: {
        occurredOn: '2026-03-13',
        title: 'Cafe',
        amount: 5_500
      }
    });

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
              amount: 5_500
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
              amount: 12_000
            }
          }
        }
      ]
    });
  } finally {
    await context.close();
  }
});
