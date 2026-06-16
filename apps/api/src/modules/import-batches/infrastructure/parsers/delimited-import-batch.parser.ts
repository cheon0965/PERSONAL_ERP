import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { CollectedTransactionType } from '@personal-erp/contracts';
import { isMoneyWon, parseMoneyWon } from '@personal-erp/money';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  Prisma
} from '@prisma/client';

type DelimitedImportSourceKind = Exclude<
  ImportSourceKind,
  | typeof ImportSourceKind.IM_BANK_PDF
  | typeof ImportSourceKind.WOORI_BANK_HTML
  | typeof ImportSourceKind.WOORI_CARD_HTML
  | typeof ImportSourceKind.KB_KOOKMIN_BANK_PDF
>;

export type ParsedImportedRowDraft = {
  rowNumber: number;
  rawPayload: Prisma.InputJsonValue;
  parseStatus: ImportedRowParseStatus;
  parseError: string | null;
  sourceFingerprint: string | null;
};

export type ParsedImportBatchDraft = {
  rowCount: number;
  parseStatus: ImportBatchParseStatus;
  rows: ParsedImportedRowDraft[];
};

export type ParsedImportedRowPayload = {
  occurredOn: string;
  occurredAt?: string | null;
  title: string;
  amount: number;
  signedAmount?: number | null;
  direction?: 'WITHDRAWAL' | 'DEPOSIT' | 'REVERSAL' | null;
  directionLabel?: string | null;
  collectTypeHint?: CollectedTransactionType | null;
  balanceAfter?: number | null;
  reversalTargetRowNumber?: number | null;
};

export type SourceFingerprintInput = {
  sourceKind: ImportSourceKind;
  occurredOn: string;
  amount: number;
  description: string;
  sourceOrigin: string | null;
};

const sourceColumnCandidates: Record<
  DelimitedImportSourceKind,
  {
    occurredOn: readonly string[];
    title: readonly string[];
    amount: readonly string[];
    sourceOrigin: readonly string[];
  }
> = {
  BANK_CSV: {
    occurredOn: ['date', 'business_date', 'businessdate', 'occurred_on'],
    title: ['title', 'description', 'memo', 'content'],
    amount: ['amount', 'amount_won', 'amountwon'],
    sourceOrigin: [
      'account',
      'account_name',
      'bank_account',
      'bank_account_name',
      'bank',
      'bank_name'
    ]
  },
  CARD_EXCEL: {
    occurredOn: ['approved_at', 'approvedat', 'date', 'occurred_on'],
    title: ['merchant', 'merchant_name', 'merchantname', 'title'],
    amount: ['amount', 'approved_amount', 'approvedamount'],
    sourceOrigin: ['card', 'card_name', 'card_label', 'card_number']
  },
  MANUAL_UPLOAD: {
    occurredOn: ['date', 'business_date', 'approved_at', 'occurred_on'],
    title: ['title', 'description', 'merchant', 'memo'],
    amount: ['amount', 'amount_won', 'approved_amount'],
    sourceOrigin: [
      'funding_account',
      'funding_account_name',
      'account',
      'account_name',
      'card',
      'card_name',
      'origin',
      'source'
    ]
  }
};

export function parseImportBatchContent(input: {
  sourceKind: ImportSourceKind;
  content: string;
}): ParsedImportBatchDraft {
  assertDelimitedImportSourceKind(input.sourceKind);
  const sourceKind = input.sourceKind;

  const normalizedContent = input.content.replace(/\r\n/g, '\n').trim();
  if (!normalizedContent) {
    throw new BadRequestException('업로드 내용이 비어 있습니다.');
  }

  const lines = normalizedContent.split('\n');
  if (lines.length < 2) {
    throw new BadRequestException('헤더와 데이터 행이 함께 있어야 합니다.');
  }

  const delimiter = readDelimiter(input.sourceKind, lines[0] ?? '');
  const headerTokens = splitDelimitedLine(lines[0] ?? '', delimiter).map(
    normalizeHeader
  );
  if (
    headerTokens.length === 0 ||
    headerTokens.every((token) => token.length === 0)
  ) {
    throw new BadRequestException('헤더를 읽을 수 없습니다.');
  }

  const rows = lines
    .slice(1)
    .map((line, index) => ({
      line,
      rowNumber: index + 2
    }))
    .filter((candidate) => candidate.line.trim().length > 0)
    .map((candidate) =>
      parseImportedRow({
        sourceKind,
        headerTokens,
        line: candidate.line,
        delimiter,
        rowNumber: candidate.rowNumber
      })
    );

  if (rows.length === 0) {
    throw new BadRequestException('데이터 행이 하나 이상 필요합니다.');
  }

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

function parseImportedRow(input: {
  sourceKind: DelimitedImportSourceKind;
  headerTokens: string[];
  line: string;
  delimiter: string;
  rowNumber: number;
}): ParsedImportedRowDraft {
  const values = splitDelimitedLine(input.line, input.delimiter);
  const original = Object.fromEntries(
    input.headerTokens.map((headerToken, index) => [
      headerToken,
      values[index]?.trim() ?? ''
    ])
  );
  const occurredOnValue = readSourceValue(
    original,
    sourceColumnCandidates[input.sourceKind].occurredOn
  );
  const titleValue = readSourceValue(
    original,
    sourceColumnCandidates[input.sourceKind].title
  );
  const amountValue = readSourceValue(
    original,
    sourceColumnCandidates[input.sourceKind].amount
  );
  const sourceOriginValue = readSourceValue(
    original,
    sourceColumnCandidates[input.sourceKind].sourceOrigin
  );

  const normalizedOccurredOn = normalizeDateToken(occurredOnValue);
  const normalizedTitle = normalizeTextToken(titleValue);
  const normalizedAmount = normalizeAmountToken(amountValue);
  const errors = [
    normalizedOccurredOn ? null : 'date 값이 올바르지 않습니다.',
    normalizedTitle ? null : 'title 값이 비어 있습니다.',
    normalizedAmount != null ? null : 'amount 값이 올바르지 않습니다.'
  ].filter((candidate): candidate is string => candidate != null);

  return {
    rowNumber: input.rowNumber,
    rawPayload: {
      original,
      parsed: {
        occurredOn: normalizedOccurredOn,
        title: normalizedTitle,
        amount: normalizedAmount
      }
    },
    parseStatus:
      errors.length === 0
        ? ImportedRowParseStatus.PARSED
        : ImportedRowParseStatus.FAILED,
    parseError: errors.length === 0 ? null : errors.join(' '),
    sourceFingerprint:
      errors.length === 0 &&
      normalizedOccurredOn &&
      normalizedTitle &&
      normalizedAmount != null
        ? buildSourceFingerprint({
            sourceKind: input.sourceKind,
            occurredOn: normalizedOccurredOn,
            amount: normalizedAmount,
            description: normalizedTitle,
            sourceOrigin: normalizeTextToken(sourceOriginValue)
          })
        : null
  };
}

export function buildSourceFingerprint(input: SourceFingerprintInput): string {
  const basis = [
    'sf:v1',
    input.sourceKind,
    input.occurredOn,
    String(input.amount),
    normalizeFingerprintToken(input.sourceOrigin) ?? 'unspecified',
    normalizeFingerprintToken(input.description) ?? 'untitled'
  ].join('|');

  return `sf:v1:${createHash('sha256').update(basis, 'utf8').digest('hex')}`;
}

export function readParsedImportedRowPayload(
  rawPayload: Prisma.JsonValue
): ParsedImportedRowPayload | null {
  if (!isRecord(rawPayload)) {
    return null;
  }

  const parsed = rawPayload.parsed;
  if (!isRecord(parsed)) {
    return null;
  }

  return typeof parsed.occurredOn === 'string' &&
    typeof parsed.title === 'string' &&
    typeof parsed.amount === 'number' &&
    normalizeDateToken(parsed.occurredOn) &&
    normalizeTextToken(parsed.title) &&
    isMoneyWon(parsed.amount)
    ? {
        occurredOn: parsed.occurredOn,
        ...(typeof parsed.occurredAt === 'string'
          ? { occurredAt: parsed.occurredAt }
          : {}),
        title: parsed.title,
        amount: parsed.amount,
        ...(typeof parsed.signedAmount === 'number'
          ? { signedAmount: parsed.signedAmount }
          : {}),
        ...(readParsedDirection(parsed.direction)
          ? { direction: readParsedDirection(parsed.direction) }
          : {}),
        ...(typeof parsed.directionLabel === 'string'
          ? { directionLabel: parsed.directionLabel }
          : {}),
        ...(readParsedCollectTypeHint(parsed.collectTypeHint)
          ? {
              collectTypeHint: readParsedCollectTypeHint(parsed.collectTypeHint)
            }
          : {}),
        ...(typeof parsed.balanceAfter === 'number'
          ? { balanceAfter: parsed.balanceAfter }
          : {}),
        ...(Number.isInteger(parsed.reversalTargetRowNumber)
          ? {
              reversalTargetRowNumber: parsed.reversalTargetRowNumber as number
            }
          : {})
      }
    : null;
}

function readParsedDirection(
  value: Prisma.JsonValue | undefined
): ParsedImportedRowPayload['direction'] {
  return value === 'WITHDRAWAL' || value === 'DEPOSIT' || value === 'REVERSAL'
    ? value
    : undefined;
}

function readParsedCollectTypeHint(
  value: Prisma.JsonValue | undefined
): ParsedImportedRowPayload['collectTypeHint'] {
  return value === 'INCOME' ||
    value === 'EXPENSE' ||
    value === 'TRANSFER' ||
    value === 'REVERSAL'
    ? value
    : undefined;
}

function readDelimiter(
  sourceKind: DelimitedImportSourceKind,
  headerLine: string
): string {
  if (sourceKind === ImportSourceKind.CARD_EXCEL) {
    return headerLine.includes('\t') ? '\t' : ',';
  }

  return headerLine.includes(',') ? ',' : '\t';
}

function assertDelimitedImportSourceKind(
  sourceKind: ImportSourceKind
): asserts sourceKind is DelimitedImportSourceKind {
  if (sourceKind === ImportSourceKind.IM_BANK_PDF) {
    throw new BadRequestException(
      'IM뱅크 PDF는 파일 첨부 업로드로 등록해 주세요.'
    );
  }

  if (sourceKind === ImportSourceKind.WOORI_BANK_HTML) {
    throw new BadRequestException(
      '우리은행 HTML은 파일 첨부 업로드로 등록해 주세요.'
    );
  }

  if (sourceKind === ImportSourceKind.WOORI_CARD_HTML) {
    throw new BadRequestException(
      '우리카드 HTML은 파일 첨부 업로드로 등록해 주세요.'
    );
  }

  if (sourceKind === ImportSourceKind.KB_KOOKMIN_BANK_PDF) {
    throw new BadRequestException(
      'KB국민은행 PDF는 파일 첨부 업로드로 등록해 주세요.'
    );
  }
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function readSourceValue(
  row: Record<string, string>,
  candidates: readonly string[]
): string | null {
  for (const candidate of candidates) {
    const value = row[candidate];
    if (value != null && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function normalizeDateToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})/);
  if (!match) {
    return null;
  }

  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : normalized;
}

function normalizeTextToken(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeFingerprintToken(value: string | null): string | null {
  const normalized = value
    ?.normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized ? normalized : null;
}

function normalizeAmountToken(value: string | null): number | null {
  if (!value) {
    return null;
  }

  return parseMoneyWon(value);
}

function isRecord(
  value: Prisma.JsonValue | undefined
): value is Record<string, Prisma.JsonValue> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
