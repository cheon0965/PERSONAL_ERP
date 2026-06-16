import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ImportBatchFileUnsupportedReason } from '@personal-erp/contracts';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  buildMinimalImBankPdfFixture,
  buildScannedImBankPdfFixture
} from './upload-fixtures';

test('POST /import-batches/files creates an import batch from an IM bank PDF attachment', async () => {
  const context = await createRequestTestContext();

  try {
    const pdf = buildMinimalImBankPdfFixture();
    const expectedHash = createHash('sha256').update(pdf).digest('hex');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.IM_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      'im-bank-statement.pdf'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;
    const rows = created.rows as Array<Record<string, unknown>>;

    assert.equal(response.status, 201);
    assert.equal(created.id, 'import-batch-1');
    assert.equal(created.sourceKind, ImportSourceKind.IM_BANK_PDF);
    assert.equal(created.fileName, 'im-bank-statement.pdf');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.fundingAccountId, 'acc-1');
    assert.equal(created.fundingAccountName, 'Main checking');
    assert.equal(created.fundingAccountType, 'BANK');
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
    assert.equal(created.parsedRowCount, 2);
    assert.equal(created.failedRowCount, 0);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.rowNumber, 1);
    assert.equal(rows[0]?.parseStatus, ImportedRowParseStatus.PARSED);
    assert.match(String(rows[0]?.sourceFingerprint), /^sf:v2:/);
    assert.deepEqual((rows[0]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-04-18',
      occurredAt: '2026-04-18T21:11:26+09:00',
      title: '카카오페이',
      amount: 10_145,
      direction: 'WITHDRAWAL',
      directionLabel: '출금',
      collectTypeHint: 'EXPENSE',
      signedAmount: -10_145,
      balanceAfter: 4_399_152,
      reversalTargetRowNumber: null,
      sourceOrigin: 'IM뱅크 PDF'
    });
    assert.deepEqual((rows[1]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-04-15',
      occurredAt: '2026-04-15T18:16:48+09:00',
      title: 'IM뱅크 입금',
      amount: 2_010_940,
      direction: 'DEPOSIT',
      directionLabel: '입금',
      collectTypeHint: 'INCOME',
      signedAmount: 2_010_940,
      balanceAfter: 4_559_447,
      reversalTargetRowNumber: null,
      sourceOrigin: 'IM뱅크 PDF'
    });
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.action === 'import_batch.upload' &&
          candidate.details.importBatchId === 'import-batch-1' &&
          candidate.details.sourceKind === ImportSourceKind.IM_BANK_PDF
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects bank statement uploads connected to a card', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts[0]!.type = 'CARD';

    const pdf = buildMinimalImBankPdfFixture();
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.IM_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      'im-bank-statement.pdf'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });

    assert.equal(response.status, 400);
    assert.match(
      JSON.stringify(response.body),
      /은행 계좌 내역 업로드에는 은행 계좌/
    );
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files requires a funding account for IM bank PDF upload', async () => {
  const context = await createRequestTestContext();

  try {
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.IM_BANK_PDF);
    formData.set(
      'file',
      new Blob([new Uint8Array(buildMinimalImBankPdfFixture())], {
        type: 'application/pdf'
      }),
      'im-bank-statement.pdf'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });

    assert.equal(response.status, 400);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects scanned IM bank PDF without a text layer explicitly', async () => {
  const context = await createRequestTestContext();

  try {
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.IM_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(buildScannedImBankPdfFixture())], {
        type: 'application/pdf'
      }),
      'im-bank-scanned.pdf'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const body = response.body as {
      code?: ImportBatchFileUnsupportedReason;
      message?: string;
    };

    assert.equal(response.status, 400);
    assert.equal(body.code, 'SCANNED_PDF_TEXT_LAYER_MISSING');
    assert.match(body.message ?? '', /텍스트 레이어가 없는 스캔 PDF/);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});
