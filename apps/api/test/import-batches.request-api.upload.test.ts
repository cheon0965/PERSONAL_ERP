import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind
} from '@prisma/client';
import { normalizeUploadedFileName } from '../src/modules/import-batches/uploaded-file-name';
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
