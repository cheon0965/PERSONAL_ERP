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
  type ParsedImportedRowDraft,
  buildSourceFingerprint
} from './import-batch.policy';

const MAX_WOORI_HTML_BYTES = 10 * 1024 * 1024;
const SEOUL_TIME_OFFSET = '+09:00';
const VESTMAIL_DECRYPTION_FAILED =
  'VESTMAIL_DECRYPTION_FAILED' satisfies ImportBatchFileUnsupportedReason;

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

  const rawHtml = input.buffer.toString('utf8');
  const isEncrypted = isVestMailEncrypted(rawHtml);

  if (isEncrypted && (!input.password || input.password.length !== 6)) {
    throw new BadRequestException(
      '우리은행 보안메일은 복호화를 위해 주민등록번호 앞자리 6자리를 입력해야 합니다.'
    );
  }

  const decryptedHtml = isEncrypted
    ? decryptVestMail(rawHtml, input.password)
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

  const parsedCount = rows.filter(
    (row) => row.parseStatus === 'PARSED'
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

// ─── Validation ──────────────────────────────────────────────────

function assertHtmlUpload(
  buffer: Buffer,
  fileName: string
): void {
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
    html.includes('WOORIBANK') &&
    html.includes('var s=') &&
    html.includes('vestmail')
  );
}

/**
 * VestMail 보안메일 복호화.
 *
 * 원본 HTML에 내장된 SEED 암호 JavaScript를 Node.js vm 샌드박스에서
 * 실행하여 복호화합니다. SEED 알고리즘을 직접 재구현하는 대신
 * 원본 코드를 그대로 활용하므로 VestMail 업데이트에도 안정적입니다.
 */
function decryptVestMail(html: string, password: string): string {
  // 1. s[] 배열 추출
  const sArrayData = extractEncryptedData(html);
  if (sArrayData.length === 0) {
    throw new BadRequestException(
      '우리은행 보안메일 HTML에서 암호화 데이터를 찾을 수 없습니다.'
    );
  }

  // 2. 암호화 라이브러리 코드 추출 (x.y SEED 구현)
  const cryptoCode = extractCryptoCode(html);
  if (!cryptoCode) {
    throw new BadRequestException(
      '우리은행 보안메일 HTML에서 암호화 코드를 찾을 수 없습니다.'
    );
  }

  // 3. vm 샌드박스에서 복호화 실행
  try {
    const decrypted = runDecryptionInSandbox(
      cryptoCode,
      sArrayData,
      password
    );

    if (!decrypted) {
      throwDecryptionFailed();
    }

    return decrypted;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    // 실제 에러를 로깅하여 원인을 파악할 수 있게 합니다.
    console.error(
      '[WooriBankParser] VestMail 복호화 중 예외 발생:',
      error instanceof Error ? error.message : error,
      error instanceof Error ? error.stack : ''
    );
    throwDecryptionFailed();
  }
}

function throwDecryptionFailed(): never {
  throw new BadRequestException({
    code: VESTMAIL_DECRYPTION_FAILED,
    message:
      '비밀번호가 올바르지 않거나 복호화에 실패했습니다. 주민등록번호 앞자리 6자리를 다시 확인해 주세요.'
  });
}

function extractEncryptedData(html: string): string[] {
  const results: string[] = [];
  const pattern = /s\[(\d+)\]\s*=\s*"([^"]+)"/g;

  for (const match of html.matchAll(pattern)) {
    const index = Number(match[1]);
    const value = match[2] ?? '';
    results[index] = value;
  }

  return results.filter((v) => v != null && v.length > 0);
}

function extractCryptoCode(html: string): string | null {
  // SEED 암호 및 SHA-256 코드가 포함된 스크립트 블록을 추출합니다.
  // 패턴: "undefined"!=typeof x&&x.b|| 로 시작하는 블록
  const scriptPattern =
    /<SCRIPT[^>]*>([\s\S]*?)<\/SCRIPT>/gi;
  const codeBlocks: string[] = [];

  for (const match of html.matchAll(scriptPattern)) {
    const content = match[1] ?? '';
    // SEED 구현 및 SHA-256이 포함된 블록
    if (
      content.includes('x.b') &&
      (content.includes('.y=') || content.includes('x.y'))
    ) {
      codeBlocks.push(content);
    }
  }

  return codeBlocks.length > 0 ? codeBlocks.join(';\n') : null;
}

/**
 * VestMail 암호화 코드를 실행하여 복호화합니다.
 *
 * vm.createContext 대신 Function 생성자를 사용합니다.
 * vm 샌드박스는 별도의 전역 컨텍스트를 만들어 Array, String 등 내장 타입이
 * 호스트와 다른 인스턴스가 됩니다. VestMail의 SEED 구현은 `b.constructor == String`
 * 같은 패턴으로 타입을 체크하는데, vm에서는 이 비교가 실패하여 복호화가 깨집니다.
 * Function 생성자는 호스트의 전역 타입을 공유하므로 이 문제가 해결됩니다.
 */
function runDecryptionInSandbox(
  cryptoCode: string,
  sArrayData: string[],
  password: string
): string {
  const mockWindow = { opera: undefined } as Record<string, unknown>;
  const mockNavigator = {
    platform: 'Win32',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    vendor: 'Google Inc.'
  };
  const mockDocument = { getElementById: () => null };

  // VestMail 코드 패치: window.x를 전역 x로 연결
  const patchedCryptoCode =
    'var x; ' +
    cryptoCode.replace(
      /k=window\.x=\{\}/,
      'k=window.x={}; x=window.x'
    );

  // s[] 데이터 설정
  const sArraySetup = sArrayData
    .map((data, i) => `s[${i}] = "${data}";`)
    .join('\n');

  // 단일 Function으로 라이브러리 로드 + 복호화 실행
  const fullScript = `
    ${patchedCryptoCode}
    ;
    var s = new Array();
    ${sArraySetup}

    var F = x.s2("${password}", {d: true});
    var z = x.s2(F, {d: true});
    F = F.slice(0, 16);
    z = z.slice(0, 16);

    var I = [];
    var success = true;
    for (var i = 0; i < s.length; i++) {
      var k = x.b.l(s[i]);
      var result = x.y.m(k, z, {c: new x.c.l(x.o.V), g: F});
      if (result == null) {
        success = false;
        break;
      }
      I[i] = result;
    }

    if (success) {
      var combined = [];
      for (var j = 0; j < I.length; j++) {
        combined = combined.concat(I[j]);
      }
      return x.j.q.z(combined);
    }
    return null;
  `;
  const runner = new Function(
    'window',
    'navigator',
    'document',
    'atob',
    'btoa',
    fullScript
  ) as (
    w: Record<string, unknown>,
    n: typeof mockNavigator,
    d: typeof mockDocument,
    a: typeof atob,
    b: typeof btoa
  ) => string | null;

  const result = runner(
    mockWindow,
    mockNavigator,
    mockDocument,
    atob,
    btoa
  );

  return result ?? '';
}

// ─── HTML table parsing ──────────────────────────────────────────

function parseWooriHeader(
  html: string,
  scope: ParseWooriBankHtmlStatementInput['fingerprintScope']
): WooriParsedHeader {
  const accountMatch = html.match(
    /계좌번호<\/th>\s*<td[^>]*>([^<]+)<\/td>/
  );
  const accountNumber = accountMatch?.[1]?.trim() ?? 'unknown';

  const periodMatch = html.match(
    /조회기간<\/th>\s*<td[^>]*>([^<]+)<\/td>/
  );
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
      : deposit != null && deposit > 0 && (withdrawal == null || withdrawal === 0)
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
