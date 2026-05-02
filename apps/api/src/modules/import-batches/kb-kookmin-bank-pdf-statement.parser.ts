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
import {
  type ParsedImportBatchDraft,
  type ParsedImportedRowDraft
} from './import-batch.policy';
import {
  readTextLayerPdfPositionedTexts,
  type PositionedText
} from './im-bank-pdf-statement.parser';

const MAX_KB_BANK_PDF_BYTES = 10 * 1024 * 1024;
const SEOUL_TIME_OFFSET = '+09:00';
const SCANNED_PDF_TEXT_LAYER_MISSING =
  'SCANNED_PDF_TEXT_LAYER_MISSING' satisfies ImportBatchFileUnsupportedReason;

type ParseKbKookminBankPdfStatementInput = {
  buffer: Buffer;
  fileName: string;
  password: string;
  fingerprintScope: {
    tenantId: string;
    ledgerId: string;
  };
};

type KbParsedHeader = {
  accountIdentifierHash: string;
  statementPeriodFrom: string | null;
  statementPeriodTo: string | null;
};

type KbParsedRow = {
  rowNumber: number;
  occurredAtText: string;
  title: string;
  withdrawalAmountText: string;
  depositAmountText: string;
  balanceAfterText: string;
  transactionType: string | null;
  branch: string | null;
};

type KbColumnLayout = {
  withdrawalX: number | null;
  depositX: number | null;
  balanceX: number | null;
};

type MoneyText = {
  x: number;
  text: string;
  amount: number;
};

export function parseKbKookminBankPdfStatement(
  input: ParseKbKookminBankPdfStatementInput
): ParsedImportBatchDraft {
  assertPdfUpload(input.buffer, input.fileName);

  // KB PDF는 표 구조가 HTML처럼 남지 않으므로 좌표가 붙은 텍스트를 먼저 복원한 뒤 행과 금액 열을 재구성한다.
  const positionedTexts = readTextLayerPdfPositionedTexts({
    buffer: input.buffer,
    password: input.password,
    serviceName: 'KB국민은행',
    fallbackUploadMessage:
      'KB국민은행에서 내려받은 거래내역 원본 PDF를 다시 업로드해 주세요.',
    missingTextLayerMessage: throwScannedPdfUnsupported
  });
  const header = readKbPdfHeader(positionedTexts, input.fingerprintScope);
  const layout = readKbColumnLayout(positionedTexts);
  const parsedRows = readKbPdfRows(positionedTexts, layout);

  if (parsedRows.length === 0) {
    throw new BadRequestException(
      'KB국민은행 PDF에서 거래 행을 찾을 수 없습니다.'
    );
  }

  const rows = parsedRows.map((row) => mapKbPdfRowToImportedRow(row, header));
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
}

function assertPdfUpload(buffer: Buffer, fileName: string): void {
  if (buffer.length === 0) {
    throw new BadRequestException('업로드 파일이 비어 있습니다.');
  }

  if (buffer.length > MAX_KB_BANK_PDF_BYTES) {
    throw new BadRequestException(
      'PDF 파일은 10MB 이하만 업로드할 수 있습니다.'
    );
  }

  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new BadRequestException('PDF 파일만 업로드할 수 있습니다.');
  }

  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new BadRequestException(
      'KB국민은행 거래내역 PDF 파일을 선택해 주세요.'
    );
  }
}

function throwScannedPdfUnsupported(): never {
  throw new BadRequestException({
    code: SCANNED_PDF_TEXT_LAYER_MISSING,
    message:
      '텍스트 레이어가 없는 스캔 PDF는 OCR 미도입 상태라 지원하지 않습니다. KB국민은행에서 내려받은 원본 거래내역 PDF를 업로드해 주세요.'
  });
}

function readKbPdfHeader(
  texts: PositionedText[],
  scope: ParseKbKookminBankPdfStatementInput['fingerprintScope']
): KbParsedHeader {
  const plainText = texts.map((candidate) => candidate.text).join(' ');
  const accountNumber =
    plainText.match(/계좌(?:번호)?\s*[:：]?\s*([0-9-]{6,})/)?.[1] ??
    plainText.match(/([0-9]{3,6}-[0-9]{2,6}-[0-9]{2,})/)?.[1] ??
    'unknown';
  const periodMatch = plainText.match(
    /(\d{4}[.-]\d{2}[.-]\d{2})\s*[~\-]\s*(\d{4}[.-]\d{2}[.-]\d{2})/
  );

  return {
    accountIdentifierHash: createHash('sha256')
      .update(
        [
          'kb-kookmin-bank-account:v1',
          scope.tenantId,
          scope.ledgerId,
          accountNumber
        ].join('|'),
        'utf8'
      )
      .digest('hex'),
    statementPeriodFrom: normalizeDateText(periodMatch?.[1] ?? null),
    statementPeriodTo: normalizeDateText(periodMatch?.[2] ?? null)
  };
}

function readKbColumnLayout(texts: PositionedText[]): KbColumnLayout {
  // 실제 행의 금액 위치는 명세서 양식에 따라 조금씩 밀릴 수 있어, 헤더 좌표를 기준으로 가장 가까운 금액을 찾는다.
  return {
    withdrawalX: readHeaderX(texts, /출금|지급|찾으신/),
    depositX: readHeaderX(texts, /입금|맡기신/),
    balanceX: readHeaderX(texts, /잔액/)
  };
}

function readHeaderX(texts: PositionedText[], pattern: RegExp): number | null {
  const candidate = texts
    .filter((text) => pattern.test(text.text))
    .sort((left, right) => right.y - left.y)[0];

  return candidate?.x ?? null;
}

function readKbPdfRows(
  texts: PositionedText[],
  layout: KbColumnLayout
): KbParsedRow[] {
  const rowGroups = new Map<string, PositionedText[]>();

  for (const text of texts) {
    const key = `${text.pageNumber}:${text.y.toFixed(2)}`;
    rowGroups.set(key, [...(rowGroups.get(key) ?? []), text]);
  }

  return [...rowGroups.values()]
    .map((items) => items.sort((left, right) => left.x - right.x))
    .map((items, index) => readKbPdfRow(items, layout, index + 1))
    .filter((row): row is KbParsedRow => row != null);
}

function readKbPdfRow(
  items: PositionedText[],
  layout: KbColumnLayout,
  fallbackRowNumber: number
): KbParsedRow | null {
  const tokens = items.map((item) => ({
    ...item,
    text: normalizePdfText(item.text)
  }));
  const occurredAt = readOccurredAtText(tokens.map((item) => item.text));

  if (!occurredAt) {
    return null;
  }

  const moneyTexts = tokens.flatMap((item) =>
    readMoneyTexts(item.text).map((moneyText) => ({
      ...moneyText,
      x: item.x
    }))
  );
  const amounts = resolveKbAmounts(moneyTexts, layout);

  if (!amounts) {
    return null;
  }

  const titleTokens = tokens
    .map((item) => item.text)
    .filter((text) => isKbTitleToken(text, occurredAt, moneyTexts));
  const title = normalizePdfText(titleTokens.join(' '));

  return {
    rowNumber:
      readRowNumber(tokens.map((item) => item.text)) ?? fallbackRowNumber,
    occurredAtText: occurredAt,
    title: title || 'KB국민은행 거래',
    withdrawalAmountText: amounts.withdrawalText,
    depositAmountText: amounts.depositText,
    balanceAfterText: amounts.balanceText,
    transactionType: readKbTransactionType(titleTokens),
    branch: readKbBranch(titleTokens)
  };
}

function readOccurredAtText(tokens: string[]): string | null {
  const joined = tokens.join(' ');
  const fullMatch = joined.match(
    /(\d{4}[.-]\d{2}[.-]\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/
  );

  if (fullMatch?.[1] && fullMatch[2]) {
    return `${normalizeDateText(fullMatch[1])} ${normalizeTimeText(fullMatch[2])}`;
  }

  const date = tokens.find((token) => /^\d{4}[.-]\d{2}[.-]\d{2}$/.test(token));
  const time = tokens.find((token) => /^\d{2}:\d{2}(?::\d{2})?$/.test(token));

  return date && time
    ? `${normalizeDateText(date)} ${normalizeTimeText(time)}`
    : null;
}

function readMoneyTexts(text: string): Array<Omit<MoneyText, 'x'>> {
  return [...text.matchAll(/[-−－]?\d[\d,]*\s*원?/g)].flatMap((match) => {
    const raw = match[0] ?? '';
    const amount = parseKbAmount(raw);

    return amount == null ? [] : [{ text: raw, amount }];
  });
}

function resolveKbAmounts(
  moneyTexts: MoneyText[],
  layout: KbColumnLayout
): {
  withdrawalText: string;
  depositText: string;
  balanceText: string;
} | null {
  if (moneyTexts.length < 2) {
    return null;
  }

  const withdrawal = findNearestMoneyText(moneyTexts, layout.withdrawalX);
  const deposit = findNearestMoneyText(moneyTexts, layout.depositX);
  const balance = findNearestMoneyText(moneyTexts, layout.balanceX);

  if (balance && (withdrawal || deposit)) {
    return {
      withdrawalText: withdrawal?.text ?? '0',
      depositText: deposit?.text ?? '0',
      balanceText: balance.text
    };
  }

  const ordered = [...moneyTexts].sort((left, right) => left.x - right.x);
  const fallbackBalance = ordered.at(-1);
  const amountColumns = ordered.slice(0, -1);

  if (!fallbackBalance || amountColumns.length === 0) {
    return null;
  }

  return {
    withdrawalText: amountColumns[0]?.text ?? '0',
    depositText: amountColumns[1]?.text ?? '0',
    balanceText: fallbackBalance.text
  };
}

function findNearestMoneyText(
  moneyTexts: MoneyText[],
  targetX: number | null
): MoneyText | null {
  if (targetX == null) {
    return null;
  }

  const nearest = moneyTexts
    .map((moneyText) => ({
      moneyText,
      distance: Math.abs(moneyText.x - targetX)
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  return nearest && nearest.distance <= 90 ? nearest.moneyText : null;
}

function mapKbPdfRowToImportedRow(
  row: KbParsedRow,
  header: KbParsedHeader
): ParsedImportedRowDraft {
  const occurredAt = parseKbOccurredAt(row.occurredAtText);
  const withdrawal = parseKbAmount(row.withdrawalAmountText);
  const deposit = parseKbAmount(row.depositAmountText);
  const balanceAfter = parseKbAmount(row.balanceAfterText);
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
  const signedAmount =
    direction == null || amount == null
      ? null
      : direction === 'WITHDRAWAL'
        ? -amount
        : amount;
  const errors = [
    occurredAt ? null : '거래일시 값을 읽을 수 없습니다.',
    direction ? null : '입출금 금액 구분을 읽을 수 없습니다.',
    amount != null ? null : '거래 금액을 읽을 수 없습니다.',
    balanceAfter != null ? null : '거래후잔액을 읽을 수 없습니다.',
    row.title ? null : '거래 설명을 읽을 수 없습니다.'
  ].filter((candidate): candidate is string => candidate != null);
  const parseStatus =
    errors.length === 0
      ? ImportedRowParseStatus.PARSED
      : ImportedRowParseStatus.FAILED;

  return {
    rowNumber: row.rowNumber,
    rawPayload: {
      original: {
        bank: 'KB_KOOKMIN_BANK',
        statementPeriodFrom: header.statementPeriodFrom,
        statementPeriodTo: header.statementPeriodTo,
        accountIdentifierHash: header.accountIdentifierHash,
        occurredAtText: row.occurredAtText,
        title: row.title,
        withdrawalAmountText: row.withdrawalAmountText,
        depositAmountText: row.depositAmountText,
        balanceAfterText: row.balanceAfterText,
        transactionType: row.transactionType,
        branch: row.branch
      },
      parsed: {
        occurredOn: occurredAt?.occurredOn ?? null,
        occurredAt: occurredAt?.occurredAt ?? null,
        title: row.title,
        amount,
        direction,
        directionLabel: readKbDirectionLabel(direction),
        collectTypeHint: readKbCollectTypeHint(direction),
        signedAmount,
        balanceAfter,
        sourceOrigin: 'KB국민은행 PDF',
        transactionType: row.transactionType,
        branch: row.branch
      }
    } satisfies Prisma.InputJsonValue,
    parseStatus,
    parseError: errors.length === 0 ? null : errors.join(' '),
    sourceFingerprint:
      parseStatus === ImportedRowParseStatus.PARSED &&
      occurredAt &&
      amount != null
        ? buildKbPdfSourceFingerprint({
            accountIdentifierHash: header.accountIdentifierHash,
            occurredAtText: row.occurredAtText,
            withdrawalAmountText: row.withdrawalAmountText,
            depositAmountText: row.depositAmountText,
            balanceAfterText: row.balanceAfterText,
            title: row.title
          })
        : null
  };
}

function parseKbOccurredAt(
  value: string
): { occurredOn: string; occurredAt: string } | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const occurredOn = `${match[1]}-${match[2]}-${match[3]}`;
  const parsedDate = new Date(`${occurredOn}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== occurredOn
  ) {
    return null;
  }

  return {
    occurredOn,
    occurredAt: `${occurredOn}T${match[4]}:${match[5]}:${match[6]}${SEOUL_TIME_OFFSET}`
  };
}

function parseKbAmount(text: string): number | null {
  return parseMoneyWon(
    text
      .replace(/[원\s]/g, '')
      .replace(/[−－]/g, '-')
      .trim()
  );
}

function buildKbPdfSourceFingerprint(input: {
  accountIdentifierHash: string;
  occurredAtText: string;
  withdrawalAmountText: string;
  depositAmountText: string;
  balanceAfterText: string;
  title: string;
}): string {
  const basis = [
    'sf:v2',
    ImportSourceKind.KB_KOOKMIN_BANK_PDF,
    input.accountIdentifierHash,
    normalizeFingerprintToken(input.occurredAtText),
    normalizeFingerprintToken(input.withdrawalAmountText),
    normalizeFingerprintToken(input.depositAmountText),
    normalizeFingerprintToken(input.balanceAfterText),
    normalizeFingerprintToken(input.title)
  ].join('|');

  return `sf:v2:${createHash('sha256').update(basis, 'utf8').digest('hex')}`;
}

function readKbDirectionLabel(
  direction: 'WITHDRAWAL' | 'DEPOSIT' | null
): string | null {
  if (direction === 'WITHDRAWAL') {
    return 'KB국민은행 출금';
  }

  if (direction === 'DEPOSIT') {
    return 'KB국민은행 입금';
  }

  return null;
}

function readKbCollectTypeHint(
  direction: 'WITHDRAWAL' | 'DEPOSIT' | null
): 'INCOME' | 'EXPENSE' | null {
  if (direction === 'WITHDRAWAL') {
    return 'EXPENSE';
  }

  if (direction === 'DEPOSIT') {
    return 'INCOME';
  }

  return null;
}

function readKbTransactionType(tokens: string[]): string | null {
  return (
    tokens.find((token) => /입금|출금|이체|자동|카드|수수료/.test(token)) ??
    null
  );
}

function readKbBranch(tokens: string[]): string | null {
  return (
    tokens.find((token) => /영업점|인터넷|스마트|ATM|KB/.test(token)) ?? null
  );
}

function isKbTitleToken(
  text: string,
  occurredAtText: string,
  moneyTexts: MoneyText[]
): boolean {
  if (!text || occurredAtText.includes(text)) {
    return false;
  }

  if (/^\d+$/.test(text) || /^\d{2}:\d{2}(?::\d{2})?$/.test(text)) {
    return false;
  }

  if (/^\d{4}[.-]\d{2}[.-]\d{2}$/.test(text)) {
    return false;
  }

  if (moneyTexts.some((moneyText) => moneyText.text === text)) {
    return false;
  }

  // "급여입금"처럼 업무명이 헤더 단어를 포함할 수 있으므로 정확한 헤더 토큰만 제외한다.
  return !/^(거래일시?|출금액|입금액|잔액|거래내용|조회|계좌번호?|순번)$/.test(
    text
  );
}

function readRowNumber(tokens: string[]): number | null {
  const candidate = tokens.find((token) => /^\d{1,5}$/.test(token));
  const value = candidate ? Number(candidate) : null;

  return Number.isInteger(value) ? value : null;
}

function normalizeDateText(value: string | null): string | null {
  return value?.replace(/[.]/g, '-') ?? null;
}

function normalizeTimeText(value: string): string {
  return /^\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

function normalizePdfText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFingerprintToken(value: string): string {
  return normalizePdfText(value).toLowerCase();
}
