import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { decode } from 'iconv-lite';
import { parseMoneyWon } from '@personal-erp/money';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  Prisma
} from '@prisma/client';
import {
  type ParsedImportBatchDraft,
  type ParsedImportedRowDraft,
  buildSourceFingerprint
} from './import-batch.policy';
import { decryptVestMailHtml } from './vestmail-html-decryption';

const MAX_WOORI_HTML_BYTES = 10 * 1024 * 1024;
const SEOUL_TIME_OFFSET = '+09:00';

export type ParseWooriBankHtmlStatementInput = {
  buffer: Buffer;
  fileName: string;
  password: string;
  fingerprintScope: {
    tenantId: string;
    ledgerId: string;
  };
};

type WooriParsedRow = {
  occurredAtText: string;
  transactionType: string;
  description: string;
  withdrawalText: string;
  depositText: string;
  balanceText: string;
  branch: string;
};

type WooriParsedHeader = {
  accountIdentifierHash: string;
  periodFrom: string | null;
  periodTo: string | null;
};

// ─── Public entry ────────────────────────────────────────────────

export function parseWooriBankHtmlStatement(
  input: ParseWooriBankHtmlStatementInput
): ParsedImportBatchDraft {
  assertHtmlUpload(input.buffer, input.fileName);

  const rawHtml = decodeWooriBankHtml(input.buffer);
  const isEncrypted = isVestMailEncrypted(rawHtml);

  const decryptedHtml = isEncrypted
    ? decryptVestMailHtml({
        html: rawHtml,
        password: input.password,
        serviceName: '우리은행',
        fallbackUploadMessage:
          '브라우저에서 열어 저장한 거래내역 HTML을 업로드해 주세요.'
      })
    : rawHtml;

  const header = parseWooriHeader(decryptedHtml, input.fingerprintScope);
  const tableRows = parseWooriTransactionTable(decryptedHtml);

  if (tableRows.length === 0) {
    throw new BadRequestException(
      '우리은행 거래내역 HTML에서 거래 행을 찾을 수 없습니다.'
    );
  }

  const rows = tableRows.map((row, index) =>
    mapWooriRowToImportedRow(row, index + 1, header)
  );

  const parsedCount = rows.filter((row) => row.parseStatus === 'PARSED').length;

  return {
    rowCount: rows.length,
    parseStatus:
      parsedCount === rows.length
        ? ImportBatchParseStatus.COMPLETED
        : parsedCount === 0
          ? ImportBatchParseStatus.FAILED
          : ImportBatchParseStatus.PARTIAL,
    rows
  };
}

// ─── Validation ──────────────────────────────────────────────────

function assertHtmlUpload(buffer: Buffer, fileName: string): void {
  if (buffer.length === 0) {
    throw new BadRequestException('업로드 파일이 비어 있습니다.');
  }

  if (buffer.length > MAX_WOORI_HTML_BYTES) {
    throw new BadRequestException(
      'HTML 파일은 10MB 이하만 업로드할 수 있습니다.'
    );
  }

  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.html') && !lower.endsWith('.htm')) {
    throw new BadRequestException(
      '우리은행 거래내역 HTML 파일을 선택해 주세요.'
    );
  }
}

// ─── VestMail detection & decryption ─────────────────────────────

function isVestMailEncrypted(html: string): boolean {
  return (
    /WOORIBANK/i.test(html) &&
    /var\s+s\s*=/.test(html) &&
    /vestmail/i.test(html)
  );
}

function decodeWooriBankHtml(buffer: Buffer): string {
  const utf8Preview = buffer.toString('utf8');
  const charsetMatch = utf8Preview.match(/charset\s*=\s*["']?([^"'\s>]+)/i);
  const charset = charsetMatch?.[1]?.toLowerCase();

  if (charset === 'euc-kr' || charset === 'ks_c_5601-1987') {
    return decode(buffer, 'euc-kr');
  }

  return utf8Preview;
}

// ─── HTML table parsing ──────────────────────────────────────────

function parseWooriHeader(
  html: string,
  scope: ParseWooriBankHtmlStatementInput['fingerprintScope']
): WooriParsedHeader {
  const accountMatch = html.match(/계좌번호<\/th>\s*<td[^>]*>([^<]+)<\/td>/);
  const accountNumber = accountMatch?.[1]?.trim() ?? 'unknown';

  const periodMatch = html.match(/조회기간<\/th>\s*<td[^>]*>([^<]+)<\/td>/);
  const periodText = periodMatch?.[1]?.trim() ?? '';
  const periodParts = periodText.match(
    /(\d{4}\.\d{2}\.\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})/
  );

  return {
    accountIdentifierHash: createHash('sha256')
      .update(
        [
          'woori-bank-account:v1',
          scope.tenantId,
          scope.ledgerId,
          accountNumber
        ].join('|'),
        'utf8'
      )
      .digest('hex'),
    periodFrom: periodParts?.[1]?.replace(/\./g, '-') ?? null,
    periodTo: periodParts?.[2]?.replace(/\./g, '-') ?? null
  };
}

function parseWooriTransactionTable(html: string): WooriParsedRow[] {
  // thead에 '거래일시' 컬럼이 있는 table의 tbody 행들을 추출
  const tablePattern =
    /<table[^>]*>[\s\S]*?거래일시[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i;
  const tableMatch = html.match(tablePattern);

  if (!tableMatch?.[1]) {
    return [];
  }

  const tbody = tableMatch[1];
  const rowPattern = /<tr>([\s\S]*?)<\/tr>/gi;
  const rows: WooriParsedRow[] = [];

  for (const rowMatch of tbody.matchAll(rowPattern)) {
    const rowHtml = rowMatch[1] ?? '';
    const cells = extractTableCells(rowHtml);

    // 우리은행 거래내역: 거래일시, 거래구분, 기재내용, 출금금액, 입금금액, 잔액, 취급점
    if (cells.length < 7) {
      continue;
    }

    const occurredAtText = cells[0]?.trim() ?? '';
    // 날짜 형식 검증: 2026.04.16 03:06:13
    if (!/^\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(occurredAtText)) {
      continue;
    }

    rows.push({
      occurredAtText,
      transactionType: cells[1]?.trim() ?? '',
      description: cells[2]?.trim() ?? '',
      withdrawalText: cells[3]?.trim() ?? '0',
      depositText: cells[4]?.trim() ?? '0',
      balanceText: cells[5]?.trim() ?? '0',
      branch: cells[6]?.trim() ?? ''
    });
  }

  return rows;
}

function extractTableCells(rowHtml: string): string[] {
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const cells: string[] = [];

  for (const cellMatch of rowHtml.matchAll(cellPattern)) {
    // HTML 태그 제거 후 텍스트만 추출
    const text = (cellMatch[1] ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .trim();
    cells.push(text);
  }

  return cells;
}

// ─── Row mapping ─────────────────────────────────────────────────

function mapWooriRowToImportedRow(
  row: WooriParsedRow,
  rowNumber: number,
  _header: WooriParsedHeader
): ParsedImportedRowDraft {
  const occurredAt = parseWooriOccurredAt(row.occurredAtText);
  const withdrawal = parseWooriAmount(row.withdrawalText);
  const deposit = parseWooriAmount(row.depositText);
  const balanceAfter = parseWooriAmount(row.balanceText);

  const direction =
    withdrawal != null && withdrawal > 0 && (deposit == null || deposit === 0)
      ? 'WITHDRAWAL'
      : deposit != null &&
          deposit > 0 &&
          (withdrawal == null || withdrawal === 0)
        ? 'DEPOSIT'
        : null;

  const amount =
    direction === 'WITHDRAWAL'
      ? withdrawal
      : direction === 'DEPOSIT'
        ? deposit
        : null;

  const title = row.description || row.transactionType || null;
  const signedAmount =
    direction == null || amount == null
      ? null
      : direction === 'WITHDRAWAL'
        ? -amount
        : amount;

  const collectTypeHint =
    direction === 'WITHDRAWAL'
      ? 'EXPENSE'
      : direction === 'DEPOSIT'
        ? 'INCOME'
        : null;

  const errors = [
    occurredAt ? null : '거래일시 값을 읽을 수 없습니다.',
    direction ? null : '입출금 금액 구분을 읽을 수 없습니다.',
    amount != null ? null : '거래 금액을 읽을 수 없습니다.',
    title ? null : '거래 설명을 읽을 수 없습니다.'
  ].filter((candidate): candidate is string => candidate != null);

  const parsed = {
    occurredOn: occurredAt?.occurredOn ?? null,
    occurredAt: occurredAt?.occurredAt ?? null,
    title,
    amount,
    direction,
    directionLabel: readWooriDirectionLabel(direction),
    collectTypeHint,
    signedAmount,
    balanceAfter,
    sourceOrigin: '우리은행 HTML',
    transactionType: row.transactionType || null,
    branch: row.branch || null
  };

  const original = {
    occurredAtText: row.occurredAtText,
    transactionType: row.transactionType,
    description: row.description,
    withdrawalText: row.withdrawalText,
    depositText: row.depositText,
    balanceText: row.balanceText,
    branch: row.branch
  };

  const parseStatus =
    errors.length === 0
      ? ImportedRowParseStatus.PARSED
      : ImportedRowParseStatus.FAILED;

  const fingerprint =
    parseStatus === 'PARSED' &&
    occurredAt?.occurredOn &&
    amount != null &&
    title
      ? buildSourceFingerprint({
          sourceKind: ImportSourceKind.WOORI_BANK_HTML,
          occurredOn: occurredAt.occurredOn,
          amount,
          description: title,
          sourceOrigin: '우리은행 HTML'
        })
      : null;

  return {
    rowNumber,
    rawPayload: { original, parsed } as unknown as Prisma.InputJsonValue,
    parseStatus,
    parseError: errors.length === 0 ? null : errors.join(' '),
    sourceFingerprint: fingerprint
  };
}

function parseWooriOccurredAt(
  text: string
): { occurredOn: string; occurredAt: string } | null {
  // 형식: 2026.04.16 03:06:13
  const match = text.match(
    /^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const occurredOn = `${year}-${month}-${day}`;
  const occurredAt = `${occurredOn}T${hour}:${minute}:${second}${SEOUL_TIME_OFFSET}`;

  return { occurredOn, occurredAt };
}

function parseWooriAmount(text: string): number | null {
  // "461,066원" → 461066, "0원" → 0
  const cleaned = text.replace(/[,원\s]/g, '');
  if (!cleaned || cleaned === '') {
    return null;
  }

  const value = parseMoneyWon(cleaned);
  return value;
}

function readWooriDirectionLabel(
  direction: 'WITHDRAWAL' | 'DEPOSIT' | null
): string | null {
  switch (direction) {
    case 'WITHDRAWAL':
      return '우리은행 출금';
    case 'DEPOSIT':
      return '우리은행 입금';
    default:
      return null;
  }
}
