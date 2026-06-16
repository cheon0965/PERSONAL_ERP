import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ImportBatchFileUnsupportedReason } from '@personal-erp/contracts';
import { ImportBatchParseStatus, ImportSourceKind } from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  buildEncryptedWooriBankVestMailFixture,
  buildImBankPdfFixture,
  buildWooriBankHtmlFixture
} from './upload-fixtures';

test('POST /import-batches/files creates an import batch from a saved Woori bank HTML statement', async () => {
  const context = await createRequestTestContext();

  try {
    const html = buildWooriBankHtmlFixture();
    const expectedHash = createHash('sha256').update(html).digest('hex');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_BANK_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'woori-statement.html'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;
    const rows = created.rows as Array<Record<string, unknown>>;

    assert.equal(response.status, 201);
    assert.equal(created.id, 'import-batch-1');
    assert.equal(created.sourceKind, ImportSourceKind.WOORI_BANK_HTML);
    assert.equal(created.fileName, 'woori-statement.html');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.fundingAccountId, 'acc-1');
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
    assert.equal(created.parsedRowCount, 2);
    assert.equal(created.failedRowCount, 0);
    assert.match(String(rows[0]?.sourceFingerprint), /^sf:v1:/);
    assert.deepEqual((rows[0]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-04-16',
      occurredAt: '2026-04-16T03:06:13+09:00',
      title: '스마트스토어 정산',
      amount: 201_940,
      direction: 'DEPOSIT',
      directionLabel: '우리은행 입금',
      collectTypeHint: 'INCOME',
      signedAmount: 201_940,
      balanceAfter: 4_559_447,
      sourceOrigin: '우리은행 HTML',
      transactionType: '입금',
      branch: '스마트뱅킹'
    });
    assert.deepEqual((rows[1]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-04-18',
      occurredAt: '2026-04-18T21:11:26+09:00',
      title: '카카오페이',
      amount: 10_145,
      direction: 'WITHDRAWAL',
      directionLabel: '우리은행 출금',
      collectTypeHint: 'EXPENSE',
      signedAmount: -10_145,
      balanceAfter: 4_399_152,
      sourceOrigin: '우리은행 HTML',
      transactionType: '출금',
      branch: '우리WON뱅킹'
    });
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files creates an import batch from an encrypted Woori bank VestMail original', async () => {
  const context = await createRequestTestContext();

  try {
    const html = buildEncryptedWooriBankVestMailFixture('123456');
    const expectedHash = createHash('sha256').update(html).digest('hex');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_BANK_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set('password', '123456');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'woori-bank-vestmail.html'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;
    const rows = created.rows as Array<Record<string, unknown>>;

    assert.equal(response.status, 201);
    assert.equal(created.id, 'import-batch-1');
    assert.equal(created.sourceKind, ImportSourceKind.WOORI_BANK_HTML);
    assert.equal(created.fileName, 'woori-bank-vestmail.html');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.fundingAccountId, 'acc-1');
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
    assert.equal(created.parsedRowCount, 2);
    assert.equal(created.failedRowCount, 0);
    assert.deepEqual((rows[0]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-04-16',
      occurredAt: '2026-04-16T03:06:13+09:00',
      title: '스마트스토어 정산',
      amount: 201_940,
      direction: 'DEPOSIT',
      directionLabel: '우리은행 입금',
      collectTypeHint: 'INCOME',
      signedAmount: 201_940,
      balanceAfter: 4_559_447,
      sourceOrigin: '우리은행 HTML',
      transactionType: '입금',
      branch: '스마트뱅킹'
    });
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects encrypted Woori bank VestMail originals without a password', async () => {
  const context = await createRequestTestContext();

  try {
    const html = buildEncryptedWooriBankVestMailFixture('123456');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_BANK_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'woori-bank-vestmail.html'
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
    assert.equal(body.code, 'VESTMAIL_DECRYPTION_FAILED');
    assert.match(body.message ?? '', /비밀번호 숫자 6자리/);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects encrypted Woori bank VestMail originals with a wrong password', async () => {
  const context = await createRequestTestContext();

  try {
    const html = buildEncryptedWooriBankVestMailFixture('123456');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_BANK_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set('password', '654321');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'woori-bank-vestmail.html'
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
    assert.equal(body.code, 'VESTMAIL_DECRYPTION_FAILED');
    assert.match(body.message ?? '', /복호화에 실패/);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects non-numeric Woori bank VestMail passwords safely', async () => {
  const context = await createRequestTestContext();

  try {
    const html = buildEncryptedWooriBankVestMailFixture('123456');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_BANK_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set('password', 'abcdef');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'woori-bank-vestmail.html'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });

    assert.equal(response.status, 400);
    assert.match(JSON.stringify(response.body), /비밀번호 숫자 6자리/);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files marks balance-reversal withdrawal rows as 승인취소', async () => {
  const context = await createRequestTestContext();

  try {
    const pdf = buildImBankPdfFixture([
      {
        rowNumber: 1,
        occurredAtText: '2025-08-02 [12:56:59]',
        withdrawalAmountText: '140,000',
        depositAmountText: '0',
        balanceAfterText: '18,667,536',
        remarks: '기분좋은self주유'
      },
      {
        rowNumber: 2,
        occurredAtText: '2025-08-02 [12:56:49]',
        withdrawalAmountText: '48,263',
        depositAmountText: '0',
        balanceAfterText: '18,527,536',
        remarks: '기분좋은self주유'
      },
      {
        rowNumber: 3,
        occurredAtText: '2025-08-02 [12:55:12]',
        withdrawalAmountText: '140,000',
        depositAmountText: '0',
        balanceAfterText: '18,575,799',
        remarks: '기분좋은self주유'
      }
    ]);
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.IM_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      'im-bank-reversal.pdf'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;
    const rows = created.rows as Array<Record<string, unknown>>;

    assert.equal(response.status, 201);
    assert.equal(rows.length, 3);
    assert.deepEqual((rows[0]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2025-08-02',
      occurredAt: '2025-08-02T12:56:59+09:00',
      title: '기분좋은self주유',
      amount: 140_000,
      direction: 'REVERSAL',
      directionLabel: '승인취소',
      collectTypeHint: 'REVERSAL',
      signedAmount: 140_000,
      balanceAfter: 18_667_536,
      reversalTargetRowNumber: 3,
      sourceOrigin: 'IM뱅크 PDF'
    });
  } finally {
    await context.close();
  }
});
