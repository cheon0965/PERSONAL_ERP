import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import type { ImportBatchFileUnsupportedReason } from '@personal-erp/contracts';
import { decode, encode } from 'iconv-lite';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind
} from '@prisma/client';
import { normalizeUploadedFileName } from '../src/modules/import-batches/uploaded-file-name';
import { encryptSeedCbcPkcs7 } from '../src/modules/import-batches/vestmail-seed-cipher';
import { createRequestTestContext } from './request-api.test-support';
import { buildImportRowFingerprint } from './import-batches.request-api.shared';

test('normalizeUploadedFileName repairs UTF-8 Korean names decoded as Latin-1', () => {
  const koreanFileName = '거래내역조회_20260419124300843.pdf';
  const mojibakeFileName = Buffer.from(koreanFileName, 'utf8').toString(
    'latin1'
  );

  assert.equal(normalizeUploadedFileName(mojibakeFileName), koreanFileName);
  assert.equal(normalizeUploadedFileName(koreanFileName), koreanFileName);
  assert.equal(
    normalizeUploadedFileName('im-bank-statement.pdf'),
    'im-bank-statement.pdf'
  );
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
    const firstFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-02',
      amount: 4_800,
      title: 'Coffee'
    });
    const secondFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-03',
      amount: 15_000,
      title: 'Lunch'
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
            amount: 4_800
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
            amount: 15_000
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

test('POST /import-batches/files creates an import batch from a KB Kookmin bank PDF attachment', async () => {
  const context = await createRequestTestContext();

  try {
    const pdf = buildMinimalKbKookminBankPdfFixture();
    const expectedHash = createHash('sha256').update(pdf).digest('hex');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.KB_KOOKMIN_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      'kb-kookmin-bank-statement.pdf'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;
    const rows = created.rows as Array<Record<string, unknown>>;

    assert.equal(response.status, 201);
    assert.equal(created.id, 'import-batch-1');
    assert.equal(created.sourceKind, ImportSourceKind.KB_KOOKMIN_BANK_PDF);
    assert.equal(created.fileName, 'kb-kookmin-bank-statement.pdf');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.fundingAccountId, 'acc-1');
    assert.equal(created.fundingAccountName, 'Main checking');
    assert.equal(created.fundingAccountType, 'BANK');
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
    assert.equal(created.parsedRowCount, 2);
    assert.equal(created.failedRowCount, 0);
    assert.equal(rows.length, 2);
    assert.match(String(rows[0]?.sourceFingerprint), /^sf:v2:/);
    assert.deepEqual((rows[0]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-05-02',
      occurredAt: '2026-05-02T13:06:13+09:00',
      title: '급여입금',
      amount: 201_940,
      direction: 'DEPOSIT',
      directionLabel: 'KB국민은행 입금',
      collectTypeHint: 'INCOME',
      signedAmount: 201_940,
      balanceAfter: 4_559_447,
      sourceOrigin: 'KB국민은행 PDF',
      transactionType: '급여입금',
      branch: null
    });
    assert.deepEqual((rows[1]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-05-01',
      occurredAt: '2026-05-01T09:14:00+09:00',
      title: '카카오페이',
      amount: 10_145,
      direction: 'WITHDRAWAL',
      directionLabel: 'KB국민은행 출금',
      collectTypeHint: 'EXPENSE',
      signedAmount: -10_145,
      balanceAfter: 4_399_152,
      sourceOrigin: 'KB국민은행 PDF',
      transactionType: null,
      branch: null
    });
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files creates an import batch from an encrypted KB Kookmin bank PDF attachment', async () => {
  const context = await createRequestTestContext();

  try {
    const pdf = buildEncryptedKbKookminBankPdfFixture('7849');
    const expectedHash = createHash('sha256').update(pdf).digest('hex');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.KB_KOOKMIN_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set('password', '7849');
    formData.set(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      'KB거래내역조회_7849_2605021306.pdf'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;
    const rows = created.rows as Array<Record<string, unknown>>;

    assert.equal(response.status, 201);
    assert.equal(created.sourceKind, ImportSourceKind.KB_KOOKMIN_BANK_PDF);
    assert.equal(created.fileName, 'KB거래내역조회_7849_2605021306.pdf');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.rowCount, 2);
    assert.equal(rows.length, 2);
    assert.equal(
      (
        (rows[0]?.rawPayload as Record<string, unknown>).parsed as Record<
          string,
          unknown
        >
      ).sourceOrigin,
      'KB국민은행 PDF'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects encrypted KB Kookmin bank PDF originals without a password', async () => {
  const context = await createRequestTestContext();

  try {
    const pdf = buildEncryptedKbKookminBankPdfFixture('7849');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.KB_KOOKMIN_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      'KB거래내역조회_7849_2605021306.pdf'
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
    assert.equal(body.code, 'PDF_DECRYPTION_FAILED');
    assert.match(body.message ?? '', /PDF 비밀번호/);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects encrypted KB Kookmin bank PDF originals with a wrong password', async () => {
  const context = await createRequestTestContext();

  try {
    const pdf = buildEncryptedKbKookminBankPdfFixture('7849');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.KB_KOOKMIN_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set('password', '0000');
    formData.set(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      'KB거래내역조회_7849_2605021306.pdf'
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
    assert.equal(body.code, 'PDF_DECRYPTION_FAILED');
    assert.match(body.message ?? '', /복호화에 실패/);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects KB Kookmin bank PDF uploads connected to a card', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts[0]!.type = 'CARD';

    const pdf = buildMinimalKbKookminBankPdfFixture();
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.KB_KOOKMIN_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      'kb-kookmin-bank-statement.pdf'
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

test('POST /import-batches/files creates an import batch from a saved Woori Card HTML statement', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts[0]!.type = 'CARD';
    context.state.accounts[0]!.name = '우리카드';

    const html = buildWooriCardHtmlFixture();
    const expectedHash = createHash('sha256').update(html).digest('hex');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_CARD_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'woori-card-statement.html'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;
    const rows = created.rows as Array<Record<string, unknown>>;

    assert.equal(response.status, 201);
    assert.equal(created.id, 'import-batch-1');
    assert.equal(created.sourceKind, ImportSourceKind.WOORI_CARD_HTML);
    assert.equal(created.fileName, 'woori-card-statement.html');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.fundingAccountId, 'acc-1');
    assert.equal(created.fundingAccountName, '우리카드');
    assert.equal(created.fundingAccountType, 'CARD');
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
    assert.equal(created.parsedRowCount, 2);
    assert.equal(created.failedRowCount, 0);
    assert.match(String(rows[0]?.sourceFingerprint), /^sf:v2:/);
    assert.deepEqual((rows[0]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-03-09',
      occurredAt: '2026-03-09T00:00:00+09:00',
      title: 'G마켓_1566-5701_gmarket.co.kr',
      amount: 13_430,
      direction: 'WITHDRAWAL',
      directionLabel: '카드 승인',
      collectTypeHint: 'EXPENSE',
      signedAmount: -13_430,
      billedAmount: 13_336,
      billingYearMonth: '2026-04',
      sourceOrigin: '우리카드 HTML · (M083)카드의정석 DISCOUNT'
    });
    assert.deepEqual((rows[1]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2025-12-24',
      occurredAt: '2025-12-24T00:00:00+09:00',
      title: '취소-구글클라우드코리아',
      amount: 15_000,
      direction: 'REVERSAL',
      directionLabel: '승인취소',
      collectTypeHint: 'REVERSAL',
      signedAmount: 15_000,
      billedAmount: 0,
      billingYearMonth: '2026-04',
      sourceOrigin: '우리카드 HTML · (M083)카드의정석 DISCOUNT'
    });
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects card statement uploads connected to a bank account', async () => {
  const context = await createRequestTestContext();

  try {
    const html = buildWooriCardHtmlFixture();
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_CARD_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'woori-card-statement.html'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });

    assert.equal(response.status, 400);
    assert.match(
      JSON.stringify(response.body),
      /카드 내역 업로드에는 카드 자금수단/
    );
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files parses Woori Card HTML with malformed numeric entities without a server error', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts[0]!.type = 'CARD';
    context.state.accounts[0]!.name = '우리카드';

    const html = encode(
      decode(buildWooriCardHtmlFixture(), 'euc-kr').replace(
        'G마켓_1566-5701_gmarket.co.kr',
        'G마켓&#999999999999;_1566-5701_gmarket.co.kr'
      ),
      'euc-kr'
    );
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_CARD_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'woori-card-statement.html'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(created.sourceKind, ImportSourceKind.WOORI_CARD_HTML);
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files creates an import batch from an encrypted Woori Card VestMail original', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts[0]!.type = 'CARD';
    context.state.accounts[0]!.name = '우리카드';

    const html = buildEncryptedWooriCardVestMailFixture('123456');
    const expectedHash = createHash('sha256').update(html).digest('hex');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_CARD_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set('password', '123456');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'WooriCard.html'
    );

    const response = await context.requestFormData('/import-batches/files', {
      headers: context.authHeaders(),
      body: formData
    });
    const created = response.body as Record<string, unknown>;
    const rows = created.rows as Array<Record<string, unknown>>;

    assert.equal(response.status, 201);
    assert.equal(created.id, 'import-batch-1');
    assert.equal(created.sourceKind, ImportSourceKind.WOORI_CARD_HTML);
    assert.equal(created.fileName, 'WooriCard.html');
    assert.equal(created.fileHash, expectedHash);
    assert.equal(created.fundingAccountId, 'acc-1');
    assert.equal(created.fundingAccountName, '우리카드');
    assert.equal(created.fundingAccountType, 'CARD');
    assert.equal(created.rowCount, 2);
    assert.equal(created.parseStatus, ImportBatchParseStatus.COMPLETED);
    assert.equal(created.parsedRowCount, 2);
    assert.equal(created.failedRowCount, 0);
    assert.deepEqual((rows[0]?.rawPayload as Record<string, unknown>).parsed, {
      occurredOn: '2026-03-09',
      occurredAt: '2026-03-09T00:00:00+09:00',
      title: 'G마켓_1566-5701_gmarket.co.kr',
      amount: 13_430,
      direction: 'WITHDRAWAL',
      directionLabel: '카드 승인',
      collectTypeHint: 'EXPENSE',
      signedAmount: -13_430,
      billedAmount: 13_336,
      billingYearMonth: '2026-04',
      sourceOrigin: '우리카드 HTML · (M083)카드의정석 DISCOUNT'
    });
  } finally {
    await context.close();
  }
});

test('POST /import-batches/files rejects encrypted Woori Card VestMail originals without a password', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts[0]!.type = 'CARD';
    context.state.accounts[0]!.name = '우리카드';

    const html = buildEncryptedWooriCardVestMailFixture('123456');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_CARD_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'WooriCard.html'
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

test('POST /import-batches/files rejects encrypted Woori Card VestMail originals with a wrong password', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts[0]!.type = 'CARD';
    context.state.accounts[0]!.name = '우리카드';

    const html = buildEncryptedWooriCardVestMailFixture('123456');
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.WOORI_CARD_HTML);
    formData.set('fundingAccountId', 'acc-1');
    formData.set('password', '654321');
    formData.set(
      'file',
      new Blob([new Uint8Array(html)], { type: 'text/html' }),
      'WooriCard.html'
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

test('POST /import-batches/files rejects scanned KB Kookmin bank PDF without a text layer explicitly', async () => {
  const context = await createRequestTestContext();

  try {
    const formData = new FormData();
    formData.set('sourceKind', ImportSourceKind.KB_KOOKMIN_BANK_PDF);
    formData.set('fundingAccountId', 'acc-1');
    formData.set(
      'file',
      new Blob([new Uint8Array(buildScannedImBankPdfFixture())], {
        type: 'application/pdf'
      }),
      'kb-kookmin-bank-scanned.pdf'
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
    assert.match(body.message ?? '', /KB국민은행/);
    assert.equal(context.state.importBatches.length, 0);
    assert.equal(context.state.importedRows.length, 0);
  } finally {
    await context.close();
  }
});

function buildWooriCardHtmlFixture(): Buffer {
  return encode(
    [
      '<!DOCTYPE html>',
      '<html lang="ko">',
      '<head><meta http-equiv="Content-Type" content="text/html; charset=EUC-KR"></head>',
      '<body>',
      '<p>우리카드 이용대금 명세서 2026 04 총 결제금액 28,430 원 결제일 2026년 04월 16일</p>',
      '<table>',
      '<tr><th>이용 일자</th><th>이용가맹점</th><th>이용금액 (해외현지금액)</th><th>당월 결제하실 금액</th><th>결제 후 잔액</th><th>포인트</th></tr>',
      '<tr><th>기간</th><th>회차</th><th>청구금액 (US$)</th><th>수수료 (환율)</th><th>이용 혜택</th><th>혜택 금액</th><th>납부하실 금액</th><th>꿀머니(모아)</th></tr>',
      '<tr><td>(M083)카드의정석 DISCOUNT</td></tr>',
      '<tr><td>03/09</td><td>G마켓_1566-5701_gmarket.co.kr</td><td>13,430</td><td>1</td><td>13,430</td><td>할인</td><td>94</td><td>13,336</td></tr>',
      '<tr><td>12/24</td><td>취소-구글클라우드코리아</td><td>-15,000</td><td>1</td><td>0</td><td>할인</td><td>105</td><td>0</td></tr>',
      '<tr><td>통합청구합계</td><td>28,430</td><td>0</td><td>0</td><td>28,430</td><td>0</td></tr>',
      '</table>',
      '</body>',
      '</html>'
    ].join('\n'),
    'euc-kr'
  );
}

function buildWooriBankHtmlFixture(): Buffer {
  return encode(
    [
      '<!DOCTYPE html>',
      '<html lang="ko">',
      '<head><meta http-equiv="Content-Type" content="text/html; charset=EUC-KR"></head>',
      '<body>',
      '<table>',
      '<thead>',
      '<tr><th>계좌번호</th><td>1002-000-000000</td></tr>',
      '<tr><th>조회기간</th><td>2026.04.01 ~ 2026.04.30</td></tr>',
      '<tr><th>거래일시</th><th>거래구분</th><th>기재내용</th><th>출금금액</th><th>입금금액</th><th>잔액</th><th>취급점</th></tr>',
      '</thead>',
      '<tbody>',
      '<tr><td>2026.04.16 03:06:13</td><td>입금</td><td>스마트스토어 정산</td><td>0원</td><td>201,940원</td><td>4,559,447원</td><td>스마트뱅킹</td></tr>',
      '<tr><td>2026.04.18 21:11:26</td><td>출금</td><td>카카오페이</td><td>10,145원</td><td>0원</td><td>4,399,152원</td><td>우리WON뱅킹</td></tr>',
      '</tbody>',
      '</table>',
      '</body>',
      '</html>'
    ].join('\n'),
    'euc-kr'
  );
}

function buildEncryptedWooriBankVestMailFixture(password: string): Buffer {
  return buildEncryptedVestMailFixture({
    html: decode(buildWooriBankHtmlFixture(), 'euc-kr'),
    password,
    markerText: 'WOORIBANK VestMail'
  });
}

function buildEncryptedWooriCardVestMailFixture(password: string): Buffer {
  return buildEncryptedVestMailFixture({
    html: decode(buildWooriCardHtmlFixture(), 'euc-kr'),
    password,
    markerText: '우리카드 VestMail'
  });
}

function buildEncryptedVestMailFixture(input: {
  html: string;
  password: string;
  markerText: string;
}): Buffer {
  const passwordHash = createHash('sha256')
    .update(Buffer.from(input.password, 'utf8'))
    .digest();
  const key = createHash('sha256')
    .update(passwordHash)
    .digest()
    .subarray(0, 16);
  const iv = passwordHash.subarray(0, 16);
  const plaintext = Buffer.concat([key, Buffer.from(input.html, 'utf8')]);
  const encrypted = encryptSeedCbcPkcs7(plaintext, key, iv);
  const envelope = Buffer.concat([
    Buffer.alloc(16),
    Buffer.from(encrypted)
  ]).toString('base64');

  return Buffer.from(
    [
      '<!DOCTYPE html>',
      '<html>',
      '<body>',
      input.markerText,
      '<script>',
      'var s= new Array();',
      `s[0] = "${envelope}";`,
      'var vestmail = true;',
      '</script>',
      '</body>',
      '</html>'
    ].join('\n'),
    'utf8'
  );
}

function buildMinimalImBankPdfFixture(): Buffer {
  return buildImBankPdfFixture([
    {
      rowNumber: 1,
      occurredAtText: '2026-04-18 [21:11:26]',
      withdrawalAmountText: '10,145',
      depositAmountText: '0',
      balanceAfterText: '4,399,152',
      remarks: '카카오페이'
    },
    {
      rowNumber: 2,
      occurredAtText: '2026-04-15 [18:16:48]',
      withdrawalAmountText: '0',
      depositAmountText: '2,010,940',
      balanceAfterText: '4,559,447',
      remarks: '*** 2026년 04'
    }
  ]);
}

function buildMinimalKbKookminBankPdfFixture(): Buffer {
  return buildKbKookminBankPdfFixture({
    rows: [
      {
        rowNumber: 1,
        occurredAtText: '2026-05-02 13:06:13',
        title: '급여입금',
        withdrawalAmountText: '0',
        depositAmountText: '201,940',
        balanceAfterText: '4,559,447'
      },
      {
        rowNumber: 2,
        occurredAtText: '2026-05-01 09:14:00',
        title: '카카오페이',
        withdrawalAmountText: '10,145',
        depositAmountText: '0',
        balanceAfterText: '4,399,152'
      }
    ]
  });
}

function buildEncryptedKbKookminBankPdfFixture(password: string): Buffer {
  return buildKbKookminBankPdfFixture({
    rows: [
      {
        rowNumber: 1,
        occurredAtText: '2026-05-02 13:06:13',
        title: '급여입금',
        withdrawalAmountText: '0',
        depositAmountText: '201,940',
        balanceAfterText: '4,559,447'
      },
      {
        rowNumber: 2,
        occurredAtText: '2026-05-01 09:14:00',
        title: '카카오페이',
        withdrawalAmountText: '10,145',
        depositAmountText: '0',
        balanceAfterText: '4,399,152'
      }
    ],
    password
  });
}

function buildScannedImBankPdfFixture(): Buffer {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'latin1'),
    buildPdfStreamObject(1, 'q\n10 0 0 10 0 0 cm\n/Im0 Do\nQ'),
    Buffer.from('%%EOF\n', 'latin1')
  ]);
}

function buildKbKookminBankPdfFixture(input: {
  rows: Array<{
    rowNumber: number;
    occurredAtText: string;
    title: string;
    withdrawalAmountText: string;
    depositAmountText: string;
    balanceAfterText: string;
  }>;
  password?: string;
}): Buffer {
  const cmap = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CMapName /Adobe-Identity-UCS def',
    'endcmap'
  ].join('\n');
  const header = [
    drawText(
      30,
      732,
      'KB국민은행 거래내역조회 계좌번호 : 7849-00-000000 조회기간 : 2026.05.01 ~ 2026.05.02'
    ),
    drawText(34.68, 717, '순번'),
    drawText(69.58, 717, '거래일시'),
    drawText(174.12, 717, '거래내용'),
    drawText(241.79, 717, '출금액'),
    drawText(302.91, 717, '입금액'),
    drawText(372.15, 717, '잔액')
  ];
  const body = input.rows.flatMap((row, index) => {
    const y = 704.3 - index * 12;

    return [
      drawText(38.31, y, String(row.rowNumber)),
      drawText(69.58, y, row.occurredAtText),
      drawText(174.12, y, row.title),
      drawText(241.79, y, row.withdrawalAmountText),
      drawText(302.91, y, row.depositAmountText),
      drawText(372.15, y, row.balanceAfterText)
    ];
  });
  const content = [...header, ...body, drawText(390, 24, '거래내역조회')].join(
    '\n'
  );

  if (input.password) {
    return buildEncryptedRevision2PdfFixture({
      password: input.password,
      streams: [
        { objectNumber: 1, content: cmap },
        { objectNumber: 2, content }
      ]
    });
  }

  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'latin1'),
    buildPdfStreamObject(1, cmap),
    buildPdfStreamObject(2, content),
    Buffer.from('%%EOF\n', 'latin1')
  ]);
}

function buildImBankPdfFixture(
  rows: Array<{
    rowNumber: number;
    occurredAtText: string;
    withdrawalAmountText: string;
    depositAmountText: string;
    balanceAfterText: string;
    remarks: string;
  }>
): Buffer {
  const cmap = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CMapName /Adobe-Identity-UCS def',
    'endcmap'
  ].join('\n');
  const header = [
    drawText(
      30,
      732,
      '고객명 : 테스트 조회계좌번호 : 092-00-000000-0 조회기간 : 2026-04-01 ~ 2026-04-30 현재잔액 : 4,399,152 원'
    ),
    drawText(34.68, 717, 'NO'),
    drawText(97.83, 717, '거래일시'),
    drawText(225.03, 717, '찾으신금액'),
    drawText(278.27, 717, '맡기신금액'),
    drawText(331.51, 717, '거래후잔액'),
    drawText(405.91, 717, '비고')
  ];
  const body = rows.flatMap((row, index) => {
    const y = 704.3 - index * 12;

    return [
      drawText(38.31, y, String(row.rowNumber)),
      drawText(69.58, y, row.occurredAtText),
      drawText(241.79, y, row.withdrawalAmountText),
      drawText(282.91, y, row.depositAmountText),
      drawText(336.15, y, row.balanceAfterText),
      drawText(383.35, y, row.remarks)
    ];
  });
  const content = [...header, ...body, drawText(390, 24, '거래내역조회')].join(
    '\n'
  );

  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'latin1'),
    buildPdfStreamObject(1, cmap),
    buildPdfStreamObject(2, content),
    Buffer.from('%%EOF\n', 'latin1')
  ]);
}

function buildPdfStreamObject(objectNumber: number, content: string): Buffer {
  const compressed = deflateSync(Buffer.from(content, 'utf8'));

  return Buffer.concat([
    Buffer.from(
      `${objectNumber} 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,
      'latin1'
    ),
    compressed,
    Buffer.from('\nendstream\nendobj\n', 'latin1')
  ]);
}

function buildEncryptedRevision2PdfFixture(input: {
  password: string;
  streams: Array<{ objectNumber: number; content: string }>;
}): Buffer {
  const permissions = -4;
  const firstFileId = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
  const ownerPassword = createHash('sha256')
    .update('test-owner-password', 'utf8')
    .digest();
  const fileKey = buildRevision2FileKeyForTest(
    input.password,
    ownerPassword,
    permissions,
    firstFileId
  );
  const userPassword = rc4ForTest(fileKey, PDF_PADDING_FOR_TEST);
  const streamObjects = input.streams.map(({ objectNumber, content }) =>
    buildEncryptedPdfStreamObject(objectNumber, content, fileKey)
  );

  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'latin1'),
    ...streamObjects,
    Buffer.from(
      [
        '16 0 obj',
        `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${ownerPassword.toString('hex')}> /U <${userPassword.toString('hex')}> /P ${permissions} >>`,
        'endobj',
        'trailer',
        `<< /Size 17 /Encrypt 16 0 R /ID [<${firstFileId.toString('hex')}><${firstFileId.toString('hex')}>] >>`,
        '%%EOF',
        ''
      ].join('\n'),
      'latin1'
    )
  ]);
}

function buildEncryptedPdfStreamObject(
  objectNumber: number,
  content: string,
  fileKey: Buffer
): Buffer {
  const compressed = deflateSync(Buffer.from(content, 'utf8'));
  const objectKey = buildPdfObjectKeyForTest(fileKey, objectNumber, 0);
  const encrypted = rc4ForTest(objectKey, compressed);

  return Buffer.concat([
    Buffer.from(
      `${objectNumber} 0 obj\n<< /Length ${encrypted.length} /Filter /FlateDecode >>\nstream\n`,
      'latin1'
    ),
    encrypted,
    Buffer.from('\nendstream\nendobj\n', 'latin1')
  ]);
}

const PDF_PADDING_FOR_TEST = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff,
  0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
  0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
]);

function buildRevision2FileKeyForTest(
  password: string,
  ownerPassword: Buffer,
  permissionsValue: number,
  firstFileId: Buffer
): Buffer {
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(permissionsValue, 0);

  return createHash('md5')
    .update(
      Buffer.concat([
        padPdfPasswordForTest(password),
        ownerPassword,
        permissions,
        firstFileId
      ])
    )
    .digest()
    .subarray(0, 5);
}

function buildPdfObjectKeyForTest(
  fileKey: Buffer,
  objectNumber: number,
  generationNumber: number
): Buffer {
  const objectSeed = Buffer.from([
    objectNumber & 0xff,
    (objectNumber >> 8) & 0xff,
    (objectNumber >> 16) & 0xff,
    generationNumber & 0xff,
    (generationNumber >> 8) & 0xff
  ]);

  return createHash('md5')
    .update(Buffer.concat([fileKey, objectSeed]))
    .digest()
    .subarray(0, Math.min(fileKey.length + 5, 16));
}

function padPdfPasswordForTest(password: string): Buffer {
  const passwordBytes = Buffer.from(password, 'utf8');

  if (passwordBytes.length >= 32) {
    return Buffer.from(passwordBytes.subarray(0, 32));
  }

  return Buffer.concat([
    passwordBytes,
    PDF_PADDING_FOR_TEST.subarray(0, 32 - passwordBytes.length)
  ]);
}

function rc4ForTest(key: Buffer, data: Buffer): Buffer {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;

  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i]! + key[i % key.length]!) & 0xff;
    [state[i], state[j]] = [state[j]!, state[i]!];
  }

  const output = Buffer.alloc(data.length);
  let i = 0;
  j = 0;

  for (let index = 0; index < data.length; index += 1) {
    i = (i + 1) & 0xff;
    j = (j + state[i]!) & 0xff;
    [state[i], state[j]] = [state[j]!, state[i]!];
    output[index] = data[index]! ^ state[(state[i]! + state[j]!) & 0xff]!;
  }

  return output;
}

function drawText(x: number, y: number, text: string): string {
  return [
    'BT',
    '/F1 8 Tf',
    `1 0 0 1 ${x} ${y} Tm`,
    `(${escapePdfLiteral(text)})Tj`,
    'ET'
  ].join('\n');
}

function escapePdfLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
