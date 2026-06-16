import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import { pushImportBatch, pushImportedRow } from './shared';

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
        fundingAccountId: null,
        fundingAccountName: null,
        fundingAccountType: null,
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
        fundingAccountId: null,
        fundingAccountName: null,
        fundingAccountType: null,
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

test('GET /import-batches compares bank balances against the first-dated row balance', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-bank-balance',
      sourceKind: ImportSourceKind.WOORI_BANK_HTML,
      fileName: 'woori-bank.html',
      fileHash: 'hash-woori-bank',
      fundingAccountId: 'acc-1',
      uploadedAt: new Date('2026-03-20T00:00:00.000Z')
    });
    pushImportedRow(context, {
      id: 'imported-row-bank-first-date',
      batchId: 'import-batch-bank-balance',
      rowNumber: 2,
      original: {
        occurredAt: '2026.03.13 09:00:00',
        title: '첫날 입금',
        amount: '50000',
        balance: '2050000'
      },
      parsed: {
        occurredOn: '2026-03-13',
        occurredAt: '2026-03-13T09:00:00+09:00',
        title: '첫날 입금',
        amount: 50_000,
        balanceAfter: 2_050_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-bank-later-date',
      batchId: 'import-batch-bank-balance',
      rowNumber: 3,
      original: {
        occurredAt: '2026.03.14 09:00:00',
        title: '다음날 출금',
        amount: '100000',
        balance: '1900000'
      },
      parsed: {
        occurredOn: '2026-03-14',
        occurredAt: '2026-03-14T09:00:00+09:00',
        title: '다음날 출금',
        amount: 100_000,
        balanceAfter: 1_900_000
      }
    });

    const response = await context.request('/import-batches', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);

    const batches = response.body as Array<{
      id: string;
      balanceDiscrepancy?: unknown;
    }>;
    const batch = batches.find(
      (candidate) => candidate.id === 'import-batch-bank-balance'
    );

    assert.deepEqual(batch?.balanceDiscrepancy, {
      importedBalanceWon: 2_050_000,
      referenceOccurredOn: '2026-03-13',
      referenceRowNumber: 2,
      ledgerBalanceWon: 2_000_000,
      differenceWon: 50_000
    });

    const detailResponse = await context.request(
      '/import-batches/import-batch-bank-balance',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(detailResponse.status, 200);
    assert.deepEqual(
      (
        detailResponse.body as {
          balanceDiscrepancy?: unknown;
        }
      ).balanceDiscrepancy,
      {
        importedBalanceWon: 2_050_000,
        referenceOccurredOn: '2026-03-13',
        referenceRowNumber: 2,
        ledgerBalanceWon: 2_000_000,
        differenceWon: 50_000
      }
    );
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
      fundingAccountId: 'acc-1',
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
      fundingAccountId: 'acc-1',
      fundingAccountName: 'Main checking',
      fundingAccountType: 'BANK',
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
