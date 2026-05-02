import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { ImportBatchFileUnsupportedReason } from '@personal-erp/contracts';

const PDF_PADDING = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff,
  0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
  0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
]);
const PDF_DECRYPTION_FAILED =
  'PDF_DECRYPTION_FAILED' satisfies ImportBatchFileUnsupportedReason;

export type PdfObjectDecryptor = {
  decryptObjectBytes(
    objectNumber: number,
    generationNumber: number,
    data: Buffer
  ): Buffer;
  dispose(): void;
};

type PdfStandardSecurityOptions = {
  password: string;
  serviceName: string;
  fallbackUploadMessage: string;
};

type PdfEncryptionDictionary = {
  revision: number;
  version: number;
  lengthBits: number;
  permissions: number;
  ownerPassword: Buffer;
  userPassword: Buffer;
};

export function createPdfStandardSecurityDecryptor(
  buffer: Buffer,
  options: PdfStandardSecurityOptions
): PdfObjectDecryptor | null {
  // KB국민은행 원본처럼 브라우저 실행 없이 처리 가능한 구형 Standard Security만 허용한다.
  // 지원 밖 암호화는 외부 도구 호출로 우회하지 않고 사용자에게 원본 재업로드를 안내한다.
  const pdf = buffer.toString('latin1');
  const encryptObjectNumber = readEncryptObjectNumber(pdf);

  if (encryptObjectNumber == null) {
    return null;
  }

  if (!options.password.trim()) {
    throwPdfDecryptionFailed(
      `${options.serviceName} 암호화 PDF를 복호화하려면 PDF 비밀번호를 입력해 주세요.`
    );
  }

  const encryptionDictionary = readEncryptionDictionary(
    pdf,
    encryptObjectNumber
  );
  const firstFileId = readFirstFileId(pdf);

  if (
    encryptionDictionary.version !== 1 ||
    encryptionDictionary.revision !== 2 ||
    encryptionDictionary.lengthBits !== 40
  ) {
    throwPdfDecryptionFailed(
      `${options.serviceName} PDF 암호화 형식은 아직 지원하지 않습니다. ${options.fallbackUploadMessage}`
    );
  }

  const fileKey = buildRevision2FileKey(
    options.password,
    encryptionDictionary,
    firstFileId
  );
  const expectedUserPassword = rc4(fileKey, PDF_PADDING);

  if (!expectedUserPassword.equals(encryptionDictionary.userPassword)) {
    fileKey.fill(0);
    expectedUserPassword.fill(0);
    throwPdfDecryptionFailed(
      `${options.serviceName} PDF 복호화에 실패했습니다. 비밀번호가 올바른지 확인하거나, ${options.fallbackUploadMessage}`
    );
  }

  expectedUserPassword.fill(0);

  return {
    decryptObjectBytes(
      objectNumber: number,
      generationNumber: number,
      data: Buffer
    ): Buffer {
      // PDF 암호화 키는 파일 단위지만 실제 스트림은 object/generation 번호별 파생 키로 풀어야 한다.
      const objectKey = buildObjectKey(fileKey, objectNumber, generationNumber);
      try {
        return rc4(objectKey, data);
      } finally {
        objectKey.fill(0);
      }
    },
    dispose(): void {
      // 비밀번호에서 파생된 파일 키는 파싱이 끝난 직후 요청 메모리에서 지운다.
      fileKey.fill(0);
    }
  };
}

function readEncryptObjectNumber(pdf: string): number | null {
  const match = pdf.match(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/);
  const objectNumber = match?.[1] ? Number(match[1]) : null;

  return Number.isInteger(objectNumber) ? objectNumber : null;
}

function readEncryptionDictionary(
  pdf: string,
  objectNumber: number
): PdfEncryptionDictionary {
  const objectStart = pdf.indexOf(`${objectNumber} 0 obj`);
  if (objectStart < 0) {
    throwPdfDecryptionFailed('PDF 암호화 정보를 찾을 수 없습니다.');
  }

  const objectEnd = pdf.indexOf('endobj', objectStart);
  const objectBody =
    objectEnd >= 0 ? pdf.slice(objectStart, objectEnd) : pdf.slice(objectStart);
  const ownerPassword = readPdfStringEntry(objectBody, '/O');
  const userPassword = readPdfStringEntry(objectBody, '/U');
  const revision = readNumberEntry(objectBody, '/R');
  const version = readNumberEntry(objectBody, '/V');
  const permissions = readNumberEntry(objectBody, '/P');
  const lengthBits = readNumberEntry(objectBody, '/Length') ?? 40;

  if (
    ownerPassword.length !== 32 ||
    userPassword.length !== 32 ||
    revision == null ||
    version == null ||
    permissions == null
  ) {
    throwPdfDecryptionFailed('PDF 암호화 정보가 올바르지 않습니다.');
  }

  return {
    revision,
    version,
    permissions,
    lengthBits,
    ownerPassword,
    userPassword
  };
}

function readNumberEntry(objectBody: string, key: string): number | null {
  const keyIndex = objectBody.indexOf(key);
  if (keyIndex < 0) {
    return null;
  }

  const match = objectBody.slice(keyIndex + key.length).match(/\s+(-?\d+)/);
  const value = match?.[1] ? Number(match[1]) : null;

  return Number.isInteger(value) ? value : null;
}

function readPdfStringEntry(objectBody: string, key: string): Buffer {
  const keyIndex = objectBody.indexOf(key);
  if (keyIndex < 0) {
    return Buffer.alloc(0);
  }

  let index = keyIndex + key.length;
  while (/\s/.test(objectBody[index] ?? '')) {
    index += 1;
  }

  if (objectBody[index] === '(') {
    return readPdfLiteralString(objectBody, index);
  }

  if (objectBody[index] === '<') {
    const endIndex = objectBody.indexOf('>', index + 1);
    if (endIndex < 0) {
      return Buffer.alloc(0);
    }

    return Buffer.from(objectBody.slice(index + 1, endIndex), 'hex');
  }

  return Buffer.alloc(0);
}

function readPdfLiteralString(value: string, startIndex: number): Buffer {
  const bytes: number[] = [];
  let index = startIndex + 1;
  let depth = 1;

  while (index < value.length && depth > 0) {
    const byte = value.charCodeAt(index) & 0xff;
    index += 1;

    if (byte === 0x5c) {
      const escaped = readEscapedLiteralByte(value, index);
      if (escaped.kind === 'byte') {
        bytes.push(escaped.value);
      }
      index = escaped.nextIndex;
      continue;
    }

    if (byte === 0x28) {
      depth += 1;
      bytes.push(byte);
      continue;
    }

    if (byte === 0x29) {
      depth -= 1;
      if (depth > 0) {
        bytes.push(byte);
      }
      continue;
    }

    bytes.push(byte);
  }

  return Buffer.from(bytes);
}

function readEscapedLiteralByte(
  value: string,
  escapedIndex: number
):
  | { kind: 'byte'; value: number; nextIndex: number }
  | { kind: 'skip'; nextIndex: number } {
  const escaped = value.charCodeAt(escapedIndex) & 0xff;

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
      return { kind: 'byte', value: escaped, nextIndex: escapedIndex + 1 };
    case 0x0a:
      return { kind: 'skip', nextIndex: escapedIndex + 1 };
    case 0x0d:
      return {
        kind: 'skip',
        nextIndex:
          value.charCodeAt(escapedIndex + 1) === 0x0a
            ? escapedIndex + 2
            : escapedIndex + 1
      };
    default:
      if (escaped >= 0x30 && escaped <= 0x37) {
        let nextIndex = escapedIndex;
        let octal = '';

        for (let count = 0; count < 3; count += 1) {
          const candidate = value.charCodeAt(nextIndex) & 0xff;
          if (candidate < 0x30 || candidate > 0x37) {
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

      return { kind: 'byte', value: escaped, nextIndex: escapedIndex + 1 };
  }
}

function readFirstFileId(pdf: string): Buffer {
  const match = pdf.match(/\/ID\s*\[\s*<([0-9A-Fa-f]+)>/);

  if (!match?.[1]) {
    throwPdfDecryptionFailed('PDF 파일 식별자를 찾을 수 없습니다.');
  }

  return Buffer.from(match[1], 'hex');
}

function buildRevision2FileKey(
  password: string,
  encryptionDictionary: PdfEncryptionDictionary,
  firstFileId: Buffer
): Buffer {
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(encryptionDictionary.permissions, 0);

  const paddedPassword = padPassword(password);
  try {
    return createHash('md5')
      .update(
        Buffer.concat([
          paddedPassword,
          encryptionDictionary.ownerPassword,
          permissions,
          firstFileId
        ])
      )
      .digest()
      .subarray(0, encryptionDictionary.lengthBits / 8);
  } finally {
    paddedPassword.fill(0);
    permissions.fill(0);
  }
}

function buildObjectKey(
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

function padPassword(password: string): Buffer {
  const passwordBytes = Buffer.from(password, 'utf8');

  if (passwordBytes.length >= 32) {
    return Buffer.from(passwordBytes.subarray(0, 32));
  }

  return Buffer.concat([
    passwordBytes,
    PDF_PADDING.subarray(0, 32 - passwordBytes.length)
  ]);
}

function rc4(key: Buffer, data: Buffer): Buffer {
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

function throwPdfDecryptionFailed(message: string): never {
  throw new BadRequestException({
    code: PDF_DECRYPTION_FAILED,
    message
  });
}
