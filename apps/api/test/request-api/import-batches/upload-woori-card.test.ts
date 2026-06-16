import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ImportBatchFileUnsupportedReason } from '@personal-erp/contracts';
import { decode, encode } from 'iconv-lite';
import { ImportBatchParseStatus, ImportSourceKind } from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  buildEncryptedWooriCardVestMailFixture,
  buildWooriCardHtmlFixture
} from './upload-fixtures';

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
