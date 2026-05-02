import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { ImportBatchFileUnsupportedReason } from '@personal-erp/contracts';
import { parseMoneyWon } from '@personal-erp/money';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  Prisma
} from '@prisma/client';
import { decode } from 'iconv-lite';
import type {
  ParsedImportBatchDraft,
  ParsedImportedRowDraft
} from './import-batch.policy';
import { decryptVestMailHtml } from './vestmail-html-decryption';

const MAX_WOORI_CARD_HTML_BYTES = 10 * 1024 * 1024;
const SEOUL_TIME_OFFSET = '+09:00';
const HTML_STATEMENT_PARSE_FAILED =
  'HTML_STATEMENT_PARSE_FAILED' satisfies ImportBatchFileUnsupportedReason;

type ParseWooriCardHtmlStatementInput = {
  buffer: Buffer;
  fileName: string;
  password: string;
  fingerprintScope: {
    tenantId: string;
    ledgerId: string;
  };
};

type WooriCardBillingContext = {
  billingYear: number;
  billingMonth: number;
  billingYearMonth: string;
};

type WooriCardStatementRow = {
  rowNumber: number;
  dateText: string;
  merchantName: string;
  usageAmountText: string;
  billedAmountText: string | null;
  cardName: string | null;
};

type TableRow = {
  cells: string[];
};

export function parseWooriCardHtmlStatement(
  input: ParseWooriCardHtmlStatementInput
): ParsedImportBatchDraft {
  assertHtmlUpload(input.buffer, input.fileName);

  try {
    const rawHtml = decodeWooriCardHtml(input.buffer);
    const html = isVestMailEncrypted(rawHtml)
      ? decryptVestMailHtml({
          html: rawHtml,
          password: input.password,
          serviceName: '우리카드',
          fallbackUploadMessage:
            '브라우저에서 열어 저장한 이용대금 명세서 HTML을 업로드해 주세요.'
        })
      : rawHtml;

    const billingContext = parseBillingContext(html);
    const statementRows = parseStatementRows(html);

    if (statementRows.length === 0) {
      throw new BadRequestException(
        '우리카드 이용대금 명세서 HTML에서 카드 이용 행을 찾을 수 없습니다.'
      );
    }

    const rows = statementRows.map((row) =>
      mapWooriCardRowToImportedRow(row, billingContext, input.fingerprintScope)
    );
    const parsedCount = rows.filter(
      (row) => row.parseStatus === ImportedRowParseStatus.PARSED
    ).length;

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
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throwHtmlParseFailed();
  }
}

function assertHtmlUpload(buffer: Buffer, fileName: string) {
  if (buffer.length === 0) {
    throw new BadRequestException('업로드 파일이 비어 있습니다.');
  }

  if (buffer.length > MAX_WOORI_CARD_HTML_BYTES) {
    throw new BadRequestException(
      'HTML 파일은 10MB 이하만 업로드할 수 있습니다.'
    );
  }

  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.html') && !lower.endsWith('.htm')) {
    throw new BadRequestException(
      '우리카드 이용대금 명세서 HTML 파일을 선택해 주세요.'
    );
  }
}

function decodeWooriCardHtml(buffer: Buffer) {
  const utf8 = buffer.toString('utf8');
  const eucKr = decode(buffer, 'euc-kr');

  if (readKoreanStatementScore(eucKr) > readKoreanStatementScore(utf8)) {
    return eucKr;
  }

  if (/charset\s*=\s*["']?euc-?kr/i.test(utf8)) {
    return eucKr;
  }

  return utf8;
}

function readKoreanStatementScore(value: string) {
  return ['우리카드', '이용대금', '이용가맹점', '총 결제금액', '결제일'].filter(
    (keyword) => value.includes(keyword)
  ).length;
}

function isVestMailEncrypted(html: string) {
  return (
    /VestMail/i.test(html) &&
    /var\s+s\s*=\s*new\s+Array/i.test(html) &&
    /s\[\d+\]\s*=/i.test(html)
  );
}

function parseBillingContext(html: string): WooriCardBillingContext {
  const text = extractPlainText(html);
  const paymentDateMatch = text.match(
    /결제일\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/
  );
  const summaryMonthMatch = text.match(/(\d{4})\s+(\d{1,2})\s+총 결제금액/);
  const yearText = paymentDateMatch?.[1] ?? summaryMonthMatch?.[1];
  const monthText = paymentDateMatch?.[2] ?? summaryMonthMatch?.[2];

  if (!yearText || !monthText) {
    throw new BadRequestException(
      '우리카드 이용대금 명세서의 청구년월을 읽을 수 없습니다.'
    );
  }

  const billingYear = Number(yearText);
  const billingMonth = Number(monthText);

  if (
    !Number.isInteger(billingYear) ||
    !Number.isInteger(billingMonth) ||
    billingMonth < 1 ||
    billingMonth > 12
  ) {
    throw new BadRequestException(
      '우리카드 이용대금 명세서의 청구년월 형식이 올바르지 않습니다.'
    );
  }

  return {
    billingYear,
    billingMonth,
    billingYearMonth: `${billingYear}-${pad2(billingMonth)}`
  };
}

function parseStatementRows(html: string): WooriCardStatementRow[] {
  const tableRows = extractTableRows(html);
  const rows: WooriCardStatementRow[] = [];
  let isInsideUsageDetails = false;
  let currentCardName: string | null = null;

  for (const tableRow of tableRows) {
    const cells = tableRow.cells;
    const firstCell = cells[0] ?? '';

    if (isUsageDetailsHeader(cells)) {
      isInsideUsageDetails = true;
      continue;
    }

    if (!isInsideUsageDetails) {
      continue;
    }

    if (/^통합청구합계/.test(firstCell)) {
      break;
    }

    if (isCardNameRow(cells)) {
      currentCardName = firstCell;
      continue;
    }

    if (/^(소계|청구합계)/.test(firstCell)) {
      continue;
    }

    if (!/^\d{1,2}\/\d{1,2}$/.test(firstCell)) {
      continue;
    }

    rows.push({
      rowNumber: rows.length + 1,
      dateText: firstCell,
      merchantName: cells[1]?.trim() ?? '',
      usageAmountText: cells[2]?.trim() ?? '',
      billedAmountText: readLastMoneyCell(cells.slice(3)),
      cardName: currentCardName
    });
  }

  return rows;
}

function isUsageDetailsHeader(cells: string[]) {
  return (
    cells.some((cell) => cell.includes('이용 일자')) &&
    cells.some((cell) => cell.includes('이용가맹점')) &&
    cells.some((cell) => cell.includes('이용금액'))
  );
}

function isCardNameRow(cells: string[]) {
  return cells.length === 1 && /^\([^)]+\)/.test(cells[0] ?? '');
}

function extractTableRows(html: string): TableRow[] {
  const bodyHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const rowMatches = bodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const rows: TableRow[] = [];

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1] ?? '';
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cellMatch) => normalizeHtmlText(cellMatch[1] ?? ''))
      .filter((cell) => cell.length > 0);

    if (cells.length > 0) {
      rows.push({ cells });
    }
  }

  return rows;
}

function mapWooriCardRowToImportedRow(
  row: WooriCardStatementRow,
  billingContext: WooriCardBillingContext,
  fingerprintScope: ParseWooriCardHtmlStatementInput['fingerprintScope']
): ParsedImportedRowDraft {
  const occurredAt = parseUsageDate(row.dateText, billingContext);
  const usageAmount = parseStatementAmount(row.usageAmountText);
  const billedAmount = row.billedAmountText
    ? parseStatementAmount(row.billedAmountText)
    : null;
  const title = normalizeMerchantName(row.merchantName);
  const isReversal =
    usageAmount != null && (usageAmount < 0 || /^취소[-\s]/.test(title ?? ''));
  const amount = usageAmount == null ? null : Math.abs(usageAmount);
  const direction = isReversal ? 'REVERSAL' : 'WITHDRAWAL';
  const collectTypeHint = isReversal ? 'REVERSAL' : 'EXPENSE';
  const sourceOrigin = row.cardName
    ? `우리카드 HTML · ${row.cardName}`
    : '우리카드 HTML';

  const errors = [
    occurredAt ? null : '이용 일자를 읽을 수 없습니다.',
    title ? null : '이용가맹점 값을 읽을 수 없습니다.',
    amount != null ? null : '이용금액을 읽을 수 없습니다.'
  ].filter((candidate): candidate is string => candidate != null);
  const parseStatus =
    errors.length === 0
      ? ImportedRowParseStatus.PARSED
      : ImportedRowParseStatus.FAILED;

  return {
    rowNumber: row.rowNumber,
    rawPayload: {
      original: {
        dateText: row.dateText,
        merchantName: row.merchantName,
        usageAmountText: row.usageAmountText,
        billedAmountText: row.billedAmountText,
        cardName: row.cardName
      },
      parsed: {
        occurredOn: occurredAt?.occurredOn ?? null,
        occurredAt: occurredAt?.occurredAt ?? null,
        title,
        amount,
        direction,
        directionLabel: isReversal ? '승인취소' : '카드 승인',
        collectTypeHint,
        signedAmount: amount == null ? null : isReversal ? amount : -amount,
        billedAmount: billedAmount == null ? null : Math.abs(billedAmount),
        billingYearMonth: billingContext.billingYearMonth,
        sourceOrigin
      }
    } as unknown as Prisma.InputJsonValue,
    parseStatus,
    parseError: errors.length === 0 ? null : errors.join(' '),
    sourceFingerprint:
      parseStatus === ImportedRowParseStatus.PARSED &&
      occurredAt &&
      amount != null &&
      title
        ? buildWooriCardSourceFingerprint({
            scope: fingerprintScope,
            billingYearMonth: billingContext.billingYearMonth,
            rowNumber: row.rowNumber,
            occurredOn: occurredAt.occurredOn,
            amount,
            title,
            sourceOrigin
          })
        : null
  };
}

function buildWooriCardSourceFingerprint(input: {
  scope: ParseWooriCardHtmlStatementInput['fingerprintScope'];
  billingYearMonth: string;
  rowNumber: number;
  occurredOn: string;
  amount: number;
  title: string;
  sourceOrigin: string;
}) {
  const basis = [
    'sf:v2',
    ImportSourceKind.WOORI_CARD_HTML,
    input.scope.tenantId,
    input.scope.ledgerId,
    input.billingYearMonth,
    String(input.rowNumber),
    input.occurredOn,
    String(input.amount),
    normalizeFingerprintToken(input.sourceOrigin),
    normalizeFingerprintToken(input.title)
  ].join('|');

  return `sf:v2:${createHash('sha256').update(basis, 'utf8').digest('hex')}`;
}

function parseUsageDate(
  value: string,
  billingContext: WooriCardBillingContext
): { occurredOn: string; occurredAt: string } | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year =
    month > billingContext.billingMonth
      ? billingContext.billingYear - 1
      : billingContext.billingYear;
  const occurredOn = `${year}-${pad2(month)}-${pad2(day)}`;
  const parsedDate = new Date(`${occurredOn}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    occurredOn,
    occurredAt: `${occurredOn}T00:00:00${SEOUL_TIME_OFFSET}`
  };
}

function readLastMoneyCell(cells: string[]) {
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const cell = cells[index] ?? '';
    if (parseStatementAmount(cell) != null) {
      return cell;
    }
  }

  return null;
}

function parseStatementAmount(value: string) {
  const normalized = value
    .replace(/[원\s]/g, '')
    .replace(/[−－]/g, '-')
    .trim();

  return parseMoneyWon(normalized);
}

function normalizeMerchantName(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

function extractPlainText(html: string) {
  return normalizeHtmlText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
  );
}

function normalizeHtmlText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      decodeHtmlCodePoint(hex, 16)
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      decodeHtmlCodePoint(decimal, 10)
    );
}

function decodeHtmlCodePoint(value: string, radix: 10 | 16) {
  const codePoint = Number.parseInt(value, radix);

  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return ' ';
  }

  return String.fromCodePoint(codePoint);
}

function throwHtmlParseFailed(): never {
  throw new BadRequestException({
    code: HTML_STATEMENT_PARSE_FAILED,
    message:
      '우리카드 HTML을 읽는 중 오류가 발생했습니다. 보안메일 비밀번호가 맞는지 확인하거나, 브라우저에서 열어 저장한 이용대금 명세서 HTML을 업로드해 주세요.'
  });
}

function normalizeFingerprintToken(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}
