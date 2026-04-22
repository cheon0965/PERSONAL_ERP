import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { BadRequestException } from '@nestjs/common';
import type { ImportBatchFileUnsupportedReason } from '@personal-erp/contracts';
import { parseMoneyWon, subtractMoneyWon } from '@personal-erp/money';
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

const MAX_IM_BANK_PDF_BYTES = 10 * 1024 * 1024;
const SEOUL_TIME_OFFSET = '+09:00';
const SCANNED_PDF_TEXT_LAYER_MISSING =
  'SCANNED_PDF_TEXT_LAYER_MISSING' satisfies ImportBatchFileUnsupportedReason;

type PdfStream = {
  objectNumber: number;
  dictionary: string;
  data: Buffer;
};

type PositionedText = {
  pageNumber: number;
  x: number;
  y: number;
  text: string;
};

type PdfToken =
  | { kind: 'literal'; value: Buffer }
  | { kind: 'number'; value: number }
  | { kind: 'name'; value: string }
  | { kind: 'symbol'; value: string }
  | { kind: 'operator'; value: string };

type ParsedPdfRow = {
  statementRowNo: number;
  occurredAtText: string;
  transactionType: string | null;
  withdrawalAmountText: string;
  depositAmountText: string;
  balanceAfterText: string;
  remarks: string | null;
  memo: string | null;
  branch: string | null;
};

type ParsedPdfHeader = {
  accountIdentifierHash: string;
  statementPeriodFrom: string | null;
  statementPeriodTo: string | null;
};

type ImBankParsedDirection = 'WITHDRAWAL' | 'DEPOSIT';

type ImBankResolvedDirection = ImBankParsedDirection | 'REVERSAL';

type PreparedImBankRow = {
  row: ParsedPdfRow;
  occurredAt: { occurredOn: string; occurredAt: string } | null;
  direction: ImBankParsedDirection | null;
  amount: number | null;
  balanceAfter: number | null;
  title: string | null;
  errors: string[];
};

export type ParseImBankPdfStatementInput = {
  buffer: Buffer;
  fileName: string;
  fingerprintScope: {
    tenantId: string;
    ledgerId: string;
  };
};

export function parseImBankPdfStatement(
  input: ParseImBankPdfStatementInput
): ParsedImportBatchDraft {
  assertPdfUpload(input.buffer, input.fileName);

  const streams = readPdfStreams(input.buffer);
  const contentStreams = streams.filter((stream) =>
    isLikelyPageContentStream(stream)
  );

  if (contentStreams.length === 0) {
    throwScannedPdfUnsupported();
  }

  const unicodeMap = readToUnicodeMap(streams);
  const positionedTexts = contentStreams.flatMap((stream, index) =>
    readPositionedTexts({
      pageNumber: index + 1,
      stream: stream.data,
      unicodeMap
    })
  );

  if (positionedTexts.length === 0) {
    throwScannedPdfUnsupported();
  }

  const header = readPdfHeader(positionedTexts, input.fingerprintScope);
  const preparedRows = readPdfRows(positionedTexts).map(prepareImBankPdfRow);
  const rows = preparedRows.map((preparedRow, index) =>
    mapPreparedImBankRowToImportedRow({
      preparedRow,
      header,
      nextPreparedRow: preparedRows[index + 1] ?? null,
      olderPreparedRows: preparedRows.slice(index + 1)
    })
  );

  if (rows.length === 0) {
    throw new BadRequestException('IM뱅크 PDF에서 거래 행을 찾을 수 없습니다.');
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

function throwScannedPdfUnsupported(): never {
  throw new BadRequestException({
    code: SCANNED_PDF_TEXT_LAYER_MISSING,
    message:
      '텍스트 레이어가 없는 스캔 PDF는 OCR 미도입 상태라 지원하지 않습니다. IM뱅크에서 내려받은 텍스트 PDF를 업로드해 주세요.'
  });
}

function assertPdfUpload(buffer: Buffer, fileName: string): void {
  if (buffer.length === 0) {
    throw new BadRequestException('업로드 파일이 비어 있습니다.');
  }

  if (buffer.length > MAX_IM_BANK_PDF_BYTES) {
    throw new BadRequestException(
      'PDF 파일은 10MB 이하만 업로드할 수 있습니다.'
    );
  }

  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new BadRequestException('PDF 파일만 업로드할 수 있습니다.');
  }

  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new BadRequestException('IM뱅크 거래내역 PDF 파일을 선택해 주세요.');
  }
}

function readPdfStreams(buffer: Buffer): PdfStream[] {
  const pdf = buffer.toString('latin1');
  const streamPattern =
    /(\d+)\s+(\d+)\s+obj([\s\S]*?)stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const streams: PdfStream[] = [];

  for (const match of pdf.matchAll(streamPattern)) {
    const objectNumber = Number(match[1]);
    const dictionary = match[3] ?? '';
    const rawStream = Buffer.from(match[4] ?? '', 'latin1');

    if (!Number.isInteger(objectNumber)) {
      continue;
    }

    try {
      streams.push({
        objectNumber,
        dictionary,
        data: dictionary.includes('/FlateDecode')
          ? inflateSync(rawStream)
          : rawStream
      });
    } catch {
      // Ignore broken auxiliary streams and let the caller fail if no text remains.
    }
  }

  return streams;
}

function readToUnicodeMap(streams: PdfStream[]): Map<number, string> {
  const cmap = streams.find((stream) =>
    stream.data.toString('latin1').includes('begincmap')
  );

  if (!cmap) {
    throw new BadRequestException(
      'PDF 문자 매핑 정보를 찾을 수 없습니다. IM뱅크 원본 PDF인지 확인해 주세요.'
    );
  }

  const unicodeMap = new Map<number, string>();
  const content = cmap.data.toString('latin1');

  for (const line of content.split(/\r?\n/)) {
    const parts = [...line.matchAll(/<([0-9A-Fa-f]+)>/g)].map(
      (candidate) => candidate[1] ?? ''
    );

    if (parts.length === 3) {
      const start = Number.parseInt(parts[0]!, 16);
      const end = Number.parseInt(parts[1]!, 16);
      const destination = Number.parseInt(parts[2]!, 16);

      for (let cid = start; cid <= end; cid += 1) {
        unicodeMap.set(cid, String.fromCodePoint(destination + cid - start));
      }
      continue;
    }

    if (parts.length === 2) {
      const cid = Number.parseInt(parts[0]!, 16);
      const destinationHex = parts[1]!;
      unicodeMap.set(cid, decodeHexUnicode(destinationHex));
    }
  }

  return unicodeMap;
}

function decodeHexUnicode(hex: string): string {
  const raw = Buffer.from(hex, 'hex');

  if (raw.length > 0 && raw.length % 2 === 0) {
    const codeUnits: number[] = [];

    for (let index = 0; index < raw.length; index += 2) {
      codeUnits.push(((raw[index] ?? 0) << 8) | (raw[index + 1] ?? 0));
    }

    return String.fromCharCode(...codeUnits);
  }

  try {
    return String.fromCodePoint(Number.parseInt(hex, 16));
  } catch {
    return '';
  }
}

function isLikelyPageContentStream(stream: PdfStream): boolean {
  if (stream.data.length > 100_000) {
    return false;
  }

  const content = stream.data.toString('latin1');
  return (
    content.includes('BT') &&
    (content.includes('Tj') || content.includes('TJ')) &&
    !content.includes('begincmap')
  );
}

function readPositionedTexts(input: {
  pageNumber: number;
  stream: Buffer;
  unicodeMap: Map<number, string>;
}): PositionedText[] {
  const rows: PositionedText[] = [];
  const stack: PdfToken[] = [];
  let x = 0;
  let y = 0;

  for (const token of tokenizePdfContent(input.stream)) {
    if (token.kind !== 'operator') {
      stack.push(token);
      continue;
    }

    switch (token.value) {
      case 'BT':
        x = 0;
        y = 0;
        stack.length = 0;
        break;
      case 'ET':
        stack.length = 0;
        break;
      case 'Td':
      case 'TD': {
        const numbers = stack
          .filter(
            (candidate): candidate is { kind: 'number'; value: number } =>
              candidate.kind === 'number'
          )
          .map((candidate) => candidate.value);
        const dx = numbers.at(-2);
        const dy = numbers.at(-1);

        if (dx != null && dy != null) {
          x += dx;
          y += dy;
        }

        stack.length = 0;
        break;
      }
      case 'Tm': {
        const numbers = stack
          .filter(
            (candidate): candidate is { kind: 'number'; value: number } =>
              candidate.kind === 'number'
          )
          .map((candidate) => candidate.value);
        const nextX = numbers.at(-2);
        const nextY = numbers.at(-1);

        if (nextX != null && nextY != null) {
          x = nextX;
          y = nextY;
        }

        stack.length = 0;
        break;
      }
      case 'Tj': {
        const literal = [...stack]
          .reverse()
          .find(
            (candidate): candidate is { kind: 'literal'; value: Buffer } =>
              candidate.kind === 'literal'
          );
        appendPositionedText(rows, {
          pageNumber: input.pageNumber,
          x,
          y,
          text: literal
            ? decodePdfLiteralText(literal.value, input.unicodeMap)
            : ''
        });
        stack.length = 0;
        break;
      }
      case 'TJ': {
        const text = stack
          .filter(
            (candidate): candidate is { kind: 'literal'; value: Buffer } =>
              candidate.kind === 'literal'
          )
          .map((literal) =>
            decodePdfLiteralText(literal.value, input.unicodeMap)
          )
          .join('');
        appendPositionedText(rows, {
          pageNumber: input.pageNumber,
          x,
          y,
          text
        });
        stack.length = 0;
        break;
      }
      default:
        stack.length = 0;
    }
  }

  return rows;
}

function appendPositionedText(
  rows: PositionedText[],
  candidate: PositionedText
): void {
  const text = normalizePdfText(candidate.text);

  if (!text) {
    return;
  }

  rows.push({
    pageNumber: candidate.pageNumber,
    x: Number(candidate.x.toFixed(2)),
    y: Number(candidate.y.toFixed(2)),
    text
  });
}

function* tokenizePdfContent(stream: Buffer): Generator<PdfToken> {
  let index = 0;

  while (index < stream.length) {
    const byte = stream[index];

    if (byte == null) {
      break;
    }

    if (isWhitespace(byte)) {
      index += 1;
      continue;
    }

    if (byte === 0x25) {
      while (
        index < stream.length &&
        stream[index] !== 0x0a &&
        stream[index] !== 0x0d
      ) {
        index += 1;
      }
      continue;
    }

    if (byte === 0x28) {
      const parsed = parsePdfLiteral(stream, index);
      yield {
        kind: 'literal',
        value: parsed.value
      };
      index = parsed.nextIndex;
      continue;
    }

    if (byte === 0x2f) {
      const start = index;
      index += 1;

      while (
        index < stream.length &&
        !isWhitespace(stream[index] ?? 0) &&
        !isDelimiter(stream[index] ?? 0)
      ) {
        index += 1;
      }

      yield {
        kind: 'name',
        value: stream.subarray(start, index).toString('latin1')
      };
      continue;
    }

    if (byte === 0x5b || byte === 0x5d || byte === 0x3c || byte === 0x3e) {
      yield {
        kind: 'symbol',
        value: String.fromCharCode(byte)
      };
      index += 1;
      continue;
    }

    const start = index;
    while (
      index < stream.length &&
      !isWhitespace(stream[index] ?? 0) &&
      !isDelimiter(stream[index] ?? 0)
    ) {
      index += 1;
    }

    const rawToken = stream.subarray(start, index).toString('latin1');
    const numberValue = Number(rawToken);

    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(rawToken)) {
      yield {
        kind: 'number',
        value: numberValue
      };
      continue;
    }

    yield rawToken.startsWith('/')
      ? {
          kind: 'name',
          value: rawToken
        }
      : {
          kind: 'operator',
          value: rawToken
        };
  }
}

function parsePdfLiteral(
  stream: Buffer,
  startIndex: number
): { value: Buffer; nextIndex: number } {
  const bytes: number[] = [];
  let index = startIndex + 1;
  let depth = 1;

  while (index < stream.length && depth > 0) {
    const byte = stream[index];

    if (byte == null) {
      break;
    }

    if (byte === 0x5c) {
      const escaped = stream[index + 1];
      if (escaped == null) {
        break;
      }

      const escapedByte = readEscapedPdfLiteralByte(stream, index + 1);
      if (escapedByte.kind === 'byte') {
        bytes.push(escapedByte.value);
      }
      index = escapedByte.nextIndex;
      continue;
    }

    if (byte === 0x28) {
      depth += 1;
      bytes.push(byte);
      index += 1;
      continue;
    }

    if (byte === 0x29) {
      depth -= 1;
      if (depth > 0) {
        bytes.push(byte);
      }
      index += 1;
      continue;
    }

    bytes.push(byte);
    index += 1;
  }

  return {
    value: Buffer.from(bytes),
    nextIndex: index
  };
}

function readEscapedPdfLiteralByte(
  stream: Buffer,
  escapedIndex: number
):
  | { kind: 'byte'; value: number; nextIndex: number }
  | { kind: 'skip'; nextIndex: number } {
  const escaped = stream[escapedIndex];

  switch (escaped) {
    case 0x6e:
      return { kind: 'byte', value: 0x0a, nextIndex: escapedIndex + 1 };
    case 0x72:
      return { kind: 'byte', value: 0x0d, nextIndex: escapedIndex + 1 };
    case 0x74:
      return { kind: 'byte', value: 0x09, nextIndex: escapedIndex + 1 };
    case 0x62:
      return { kind: 'byte', value: 0x08, nextIndex: escapedIndex + 1 };
    case 0x66:
      return { kind: 'byte', value: 0x0c, nextIndex: escapedIndex + 1 };
    case 0x28:
    case 0x29:
    case 0x5c:
      return {
        kind: 'byte',
        value: escaped,
        nextIndex: escapedIndex + 1
      };
    case 0x0a:
      return { kind: 'skip', nextIndex: escapedIndex + 1 };
    case 0x0d:
      return {
        kind: 'skip',
        nextIndex:
          stream[escapedIndex + 1] === 0x0a
            ? escapedIndex + 2
            : escapedIndex + 1
      };
    default:
      if (escaped != null && escaped >= 0x30 && escaped <= 0x37) {
        let nextIndex = escapedIndex;
        let octal = '';

        for (let count = 0; count < 3; count += 1) {
          const candidate = stream[nextIndex];
          if (candidate == null || candidate < 0x30 || candidate > 0x37) {
            break;
          }

          octal += String.fromCharCode(candidate);
          nextIndex += 1;
        }

        return {
          kind: 'byte',
          value: Number.parseInt(octal, 8) & 0xff,
          nextIndex
        };
      }

      return {
        kind: 'byte',
        value: escaped ?? 0x5c,
        nextIndex: escapedIndex + 1
      };
  }
}

function decodePdfLiteralText(
  raw: Buffer,
  unicodeMap: Map<number, string>
): string {
  if (raw.length % 2 === 0) {
    const decoded: string[] = [];
    let mappedCount = 0;

    for (let index = 0; index < raw.length; index += 2) {
      const high = raw[index] ?? 0;
      const low = raw[index + 1] ?? 0;
      const cid = (high << 8) | low;
      const mapped = unicodeMap.get(cid);

      if (mapped != null) {
        decoded.push(mapped);
        mappedCount += 1;
      } else {
        decoded.push('');
      }
    }

    if (mappedCount > 0) {
      return decoded.join('');
    }
  }

  return raw.toString('utf8');
}

function readPdfHeader(
  texts: PositionedText[],
  scope: ParseImBankPdfStatementInput['fingerprintScope']
): ParsedPdfHeader {
  const headerText =
    texts.find((candidate) => candidate.text.includes('조회계좌번호'))?.text ??
    '';
  const accountNumber =
    headerText.match(/조회계좌번호\s*:\s*([^\s]+)/)?.[1] ?? 'unknown';
  const periodMatch = headerText.match(
    /조회기간\s*:\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/
  );

  return {
    accountIdentifierHash: createHash('sha256')
      .update(
        [
          'im-bank-account:v1',
          scope.tenantId,
          scope.ledgerId,
          accountNumber
        ].join('|'),
        'utf8'
      )
      .digest('hex'),
    statementPeriodFrom: periodMatch?.[1] ?? null,
    statementPeriodTo: periodMatch?.[2] ?? null
  };
}

function readPdfRows(texts: PositionedText[]): ParsedPdfRow[] {
  const rowGroups = new Map<string, PositionedText[]>();

  for (const text of texts) {
    const key = `${text.pageNumber}:${text.y.toFixed(2)}`;
    rowGroups.set(key, [...(rowGroups.get(key) ?? []), text]);
  }

  return [...rowGroups.values()]
    .map((items) => items.sort((left, right) => left.x - right.x))
    .map(readPdfRow)
    .filter((row): row is ParsedPdfRow => row != null)
    .sort((left, right) => left.statementRowNo - right.statementRowNo);
}

function readPdfRow(items: PositionedText[]): ParsedPdfRow | null {
  const statementRowNoText = readColumnText(items, 30, 52);
  const occurredAtText = readColumnText(items, 52, 174);

  if (
    !/^\d+$/.test(statementRowNoText) ||
    !/^\d{4}-\d{2}-\d{2} \[\d{2}:\d{2}:\d{2}\]$/.test(occurredAtText)
  ) {
    return null;
  }

  return {
    statementRowNo: Number(statementRowNoText),
    occurredAtText,
    transactionType: nullIfBlank(readColumnText(items, 174, 217)),
    withdrawalAmountText: readColumnText(items, 217, 270) || '0',
    depositAmountText: readColumnText(items, 270, 324) || '0',
    balanceAfterText: readColumnText(items, 324, 377),
    remarks: nullIfBlank(readColumnText(items, 377, 450)),
    memo: nullIfStatementNotice(readColumnText(items, 450, 513)),
    branch: nullIfBlank(readColumnText(items, 513, 565))
  };
}

function readColumnText(
  items: PositionedText[],
  minX: number,
  maxX: number
): string {
  return normalizePdfText(
    items
      .filter((item) => item.x >= minX && item.x < maxX)
      .map((item) => item.text)
      .join(' ')
  );
}

function prepareImBankPdfRow(row: ParsedPdfRow): PreparedImBankRow {
  const occurredAt = parseImBankOccurredAt(row.occurredAtText);
  const withdrawalAmount = parseMoneyWon(row.withdrawalAmountText);
  const depositAmount = parseMoneyWon(row.depositAmountText);
  const balanceAfter = parseMoneyWon(row.balanceAfterText);
  const direction =
    withdrawalAmount != null && withdrawalAmount > 0 && depositAmount === 0
      ? 'WITHDRAWAL'
      : depositAmount != null && depositAmount > 0 && withdrawalAmount === 0
        ? 'DEPOSIT'
        : null;
  const amount =
    direction === 'WITHDRAWAL'
      ? withdrawalAmount
      : direction === 'DEPOSIT'
        ? depositAmount
        : null;
  const title = readImBankRowTitle(row, direction);
  const errors = [
    occurredAt ? null : '거래일시 값을 읽을 수 없습니다.',
    direction ? null : '입출금 금액 구분을 읽을 수 없습니다.',
    amount != null ? null : '거래 금액을 읽을 수 없습니다.',
    balanceAfter != null ? null : '거래후잔액을 읽을 수 없습니다.',
    title ? null : '거래 설명을 읽을 수 없습니다.'
  ].filter((candidate): candidate is string => candidate != null);

  return {
    row,
    occurredAt,
    direction,
    amount,
    balanceAfter,
    title,
    errors
  };
}

function mapPreparedImBankRowToImportedRow(input: {
  preparedRow: PreparedImBankRow;
  header: ParsedPdfHeader;
  nextPreparedRow: PreparedImBankRow | null;
  olderPreparedRows: PreparedImBankRow[];
}): ParsedImportedRowDraft {
  const { preparedRow, header, nextPreparedRow, olderPreparedRows } = input;
  const isReversal = detectImBankBalanceReversal(preparedRow, nextPreparedRow);
  const reversalTarget = isReversal
    ? findImBankReversalTarget(preparedRow, olderPreparedRows)
    : null;
  const resolvedDirection: ImBankResolvedDirection | null =
    preparedRow.direction == null
      ? null
      : isReversal
        ? 'REVERSAL'
        : preparedRow.direction;
  const signedAmount =
    preparedRow.direction == null || preparedRow.amount == null
      ? null
      : preparedRow.direction === 'WITHDRAWAL'
        ? -preparedRow.amount
        : preparedRow.amount;
  const parsed = {
    occurredOn: preparedRow.occurredAt?.occurredOn ?? null,
    occurredAt: preparedRow.occurredAt?.occurredAt ?? null,
    title: preparedRow.title,
    amount: preparedRow.amount,
    direction: resolvedDirection,
    directionLabel: readImBankDirectionLabel(resolvedDirection),
    collectTypeHint: readImBankCollectTypeHint(resolvedDirection),
    signedAmount:
      isReversal && signedAmount != null ? signedAmount * -1 : signedAmount,
    balanceAfter: preparedRow.balanceAfter,
    reversalTargetRowNumber: reversalTarget?.row.statementRowNo ?? null,
    sourceOrigin: 'IM뱅크 PDF'
  };
  const original = {
    bank: 'IM_BANK_DAEGU',
    statementRowNo: preparedRow.row.statementRowNo,
    statementPeriodFrom: header.statementPeriodFrom,
    statementPeriodTo: header.statementPeriodTo,
    accountIdentifierHash: header.accountIdentifierHash,
    occurredAtText: preparedRow.row.occurredAtText,
    transactionType: preparedRow.row.transactionType,
    withdrawalAmountText: preparedRow.row.withdrawalAmountText,
    depositAmountText: preparedRow.row.depositAmountText,
    balanceAfterText: preparedRow.row.balanceAfterText,
    remarks: preparedRow.row.remarks,
    memo: preparedRow.row.memo,
    branch: preparedRow.row.branch
  };

  return {
    rowNumber: preparedRow.row.statementRowNo,
    rawPayload: {
      original,
      parsed
    } satisfies Prisma.InputJsonValue,
    parseStatus:
      preparedRow.errors.length === 0
        ? ImportedRowParseStatus.PARSED
        : ImportedRowParseStatus.FAILED,
    parseError:
      preparedRow.errors.length === 0 ? null : preparedRow.errors.join(' '),
    sourceFingerprint:
      preparedRow.errors.length === 0 &&
      preparedRow.occurredAt &&
      preparedRow.amount != null &&
      preparedRow.title &&
      preparedRow.balanceAfter != null
        ? buildImBankPdfSourceFingerprint({
            accountIdentifierHash: header.accountIdentifierHash,
            occurredAtText: preparedRow.row.occurredAtText,
            withdrawalAmountText: preparedRow.row.withdrawalAmountText,
            depositAmountText: preparedRow.row.depositAmountText,
            balanceAfterText: preparedRow.row.balanceAfterText,
            title: preparedRow.title
          })
        : null
  };
}

function detectImBankBalanceReversal(
  preparedRow: PreparedImBankRow,
  nextPreparedRow: PreparedImBankRow | null
): boolean {
  if (
    !nextPreparedRow ||
    preparedRow.direction == null ||
    preparedRow.amount == null ||
    preparedRow.balanceAfter == null ||
    nextPreparedRow.balanceAfter == null
  ) {
    return false;
  }

  const observedBalanceDelta = subtractMoneyWon(
    preparedRow.balanceAfter,
    nextPreparedRow.balanceAfter
  );
  const expectedBalanceDelta =
    preparedRow.direction === 'WITHDRAWAL'
      ? subtractMoneyWon(0, preparedRow.amount)
      : preparedRow.amount;

  return observedBalanceDelta === subtractMoneyWon(0, expectedBalanceDelta);
}

function findImBankReversalTarget(
  preparedRow: PreparedImBankRow,
  olderPreparedRows: PreparedImBankRow[]
): PreparedImBankRow | null {
  if (
    preparedRow.direction == null ||
    preparedRow.amount == null ||
    preparedRow.title == null ||
    preparedRow.occurredAt == null
  ) {
    return null;
  }

  const currentOccurredAt = Date.parse(preparedRow.occurredAt.occurredAt);

  for (const candidate of olderPreparedRows) {
    if (
      candidate.direction !== preparedRow.direction ||
      candidate.amount !== preparedRow.amount ||
      candidate.title !== preparedRow.title ||
      candidate.occurredAt == null
    ) {
      continue;
    }

    const candidateOccurredAt = Date.parse(candidate.occurredAt.occurredAt);
    if (
      Number.isNaN(currentOccurredAt) ||
      Number.isNaN(candidateOccurredAt) ||
      candidateOccurredAt > currentOccurredAt
    ) {
      continue;
    }

    if (currentOccurredAt - candidateOccurredAt <= 15 * 60 * 1000) {
      return candidate;
    }
  }

  return null;
}

function readImBankDirectionLabel(
  direction: ImBankResolvedDirection | null
): string | null {
  if (direction === 'REVERSAL') {
    return '승인취소';
  }

  if (direction === 'WITHDRAWAL') {
    return '출금';
  }

  if (direction === 'DEPOSIT') {
    return '입금';
  }

  return null;
}

function readImBankCollectTypeHint(
  direction: ImBankResolvedDirection | null
): 'INCOME' | 'EXPENSE' | 'REVERSAL' | null {
  if (direction === 'REVERSAL') {
    return 'REVERSAL';
  }

  if (direction === 'WITHDRAWAL') {
    return 'EXPENSE';
  }

  if (direction === 'DEPOSIT') {
    return 'INCOME';
  }

  return null;
}

function buildImBankPdfSourceFingerprint(input: {
  accountIdentifierHash: string;
  occurredAtText: string;
  withdrawalAmountText: string;
  depositAmountText: string;
  balanceAfterText: string;
  title: string;
}): string {
  const v2Basis = [
    'sf:v2',
    ImportSourceKind.IM_BANK_PDF,
    input.accountIdentifierHash,
    normalizeFingerprintToken(input.occurredAtText),
    normalizeFingerprintToken(input.withdrawalAmountText),
    normalizeFingerprintToken(input.depositAmountText),
    normalizeFingerprintToken(input.balanceAfterText),
    normalizeFingerprintToken(input.title)
  ].join('|');

  return `sf:v2:${createHash('sha256').update(v2Basis, 'utf8').digest('hex')}`;
}

function parseImBankOccurredAt(
  value: string
): { occurredOn: string; occurredAt: string } | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2}) \[(\d{2}):(\d{2}):(\d{2})\]$/
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

function readImBankRowTitle(
  row: ParsedPdfRow,
  direction: ImBankParsedDirection | null
): string | null {
  const title =
    [row.remarks, row.memo, row.branch, row.transactionType].find(
      (candidate): candidate is string =>
        candidate != null && !isStatementNotice(candidate)
    ) ?? null;

  if (title) {
    return title;
  }

  if (direction === 'WITHDRAWAL') {
    return 'IM뱅크 출금';
  }

  if (direction === 'DEPOSIT') {
    return 'IM뱅크 입금';
  }

  return null;
}

function nullIfBlank(value: string): string | null {
  return value ? value : null;
}

function nullIfStatementNotice(value: string): string | null {
  if (!value || isStatementNotice(value)) {
    return null;
  }

  return value;
}

function isStatementNotice(value: string): boolean {
  return (
    value.startsWith('*** ') ||
    value.includes('영플러스통장') ||
    value.includes('수수료 면제가능') ||
    value === '횟수'
  );
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

function isWhitespace(byte: number): boolean {
  return (
    byte === 0x00 ||
    byte === 0x09 ||
    byte === 0x0a ||
    byte === 0x0c ||
    byte === 0x0d ||
    byte === 0x20
  );
}

function isDelimiter(byte: number): boolean {
  return (
    byte === 0x28 ||
    byte === 0x29 ||
    byte === 0x3c ||
    byte === 0x3e ||
    byte === 0x5b ||
    byte === 0x5d ||
    byte === 0x7b ||
    byte === 0x7d ||
    byte === 0x2f ||
    byte === 0x25
  );
}
