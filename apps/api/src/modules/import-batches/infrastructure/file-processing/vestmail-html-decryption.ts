import { createHash, timingSafeEqual } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { ImportBatchFileUnsupportedReason } from '@personal-erp/contracts';
import { decryptSeedCbcPkcs7 } from './vestmail-seed-cipher';

const VESTMAIL_DECRYPTION_FAILED =
  'VESTMAIL_DECRYPTION_FAILED' satisfies ImportBatchFileUnsupportedReason;
const VESTMAIL_PASSWORD_PATTERN = /^\d{6}$/;
const VESTMAIL_ENVELOPE_HEADER_BYTES = 16;

export function decryptVestMailHtml(input: {
  html: string;
  password: string;
  serviceName: string;
  fallbackUploadMessage: string;
}): string {
  if (!VESTMAIL_PASSWORD_PATTERN.test(input.password)) {
    throw new BadRequestException({
      code: VESTMAIL_DECRYPTION_FAILED,
      message: `암호화된 ${input.serviceName} VestMail 원본을 복호화하려면 보안메일 비밀번호 숫자 6자리를 입력해 주세요.`
    });
  }

  const encryptedChunks = extractVestMailEncryptedChunks(input.html);
  if (encryptedChunks.length === 0) {
    throwDecryptionFailed(input.serviceName, input.fallbackUploadMessage);
  }

  const passwordHash = sha256Bytes(Buffer.from(input.password, 'utf8'));
  const keyMaterial = sha256Bytes(passwordHash);
  const iv = passwordHash.subarray(0, VESTMAIL_ENVELOPE_HEADER_BYTES);
  const key = keyMaterial.subarray(0, VESTMAIL_ENVELOPE_HEADER_BYTES);

  try {
    const decryptedChunks = encryptedChunks.map((chunk) =>
      decryptVestMailChunk(
        chunk,
        key,
        iv,
        input.serviceName,
        input.fallbackUploadMessage
      )
    );

    return Buffer.concat(decryptedChunks).toString('utf8');
  } finally {
    passwordHash.fill(0);
    keyMaterial.fill(0);
  }
}

function extractVestMailEncryptedChunks(html: string): string[] {
  const chunkPattern = /s\[(\d+)\]\s*=\s*["']([^"']+)["']/gi;
  return Array.from(html.matchAll(chunkPattern))
    .map((match) => ({
      index: Number(match[1]),
      value: match[2] ?? ''
    }))
    .filter((chunk) => Number.isInteger(chunk.index) && chunk.value.length > 0)
    .sort((left, right) => left.index - right.index)
    .map((chunk) => chunk.value);
}

function decryptVestMailChunk(
  encryptedChunk: string,
  key: Uint8Array,
  iv: Uint8Array,
  serviceName: string,
  fallbackUploadMessage: string
): Buffer {
  const envelope = decodeBase64Chunk(
    encryptedChunk,
    serviceName,
    fallbackUploadMessage
  );

  if (
    envelope.length <= VESTMAIL_ENVELOPE_HEADER_BYTES ||
    (envelope.length - VESTMAIL_ENVELOPE_HEADER_BYTES) %
      VESTMAIL_ENVELOPE_HEADER_BYTES !==
      0
  ) {
    throwDecryptionFailed(serviceName, fallbackUploadMessage);
  }

  try {
    const decrypted = decryptSeedCbcPkcs7(
      envelope.subarray(VESTMAIL_ENVELOPE_HEADER_BYTES),
      key,
      iv
    );
    const authMarker = decrypted.subarray(0, VESTMAIL_ENVELOPE_HEADER_BYTES);
    const payload = decrypted.subarray(VESTMAIL_ENVELOPE_HEADER_BYTES);

    if (
      authMarker.length !== key.length ||
      payload.length === 0 ||
      !timingSafeEqual(Buffer.from(authMarker), Buffer.from(key))
    ) {
      throwDecryptionFailed(serviceName, fallbackUploadMessage);
    }

    return Buffer.from(payload);
  } catch {
    throwDecryptionFailed(serviceName, fallbackUploadMessage);
  }
}

function decodeBase64Chunk(
  encryptedChunk: string,
  serviceName: string,
  fallbackUploadMessage: string
): Buffer {
  const normalized = encryptedChunk.replace(/\s/g, '');
  if (
    normalized.length === 0 ||
    normalized.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    throwDecryptionFailed(serviceName, fallbackUploadMessage);
  }

  return Buffer.from(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='),
    'base64'
  );
}

function sha256Bytes(value: Uint8Array): Buffer {
  return createHash('sha256').update(value).digest();
}

function throwDecryptionFailed(
  serviceName: string,
  fallbackUploadMessage: string
): never {
  throw new BadRequestException({
    code: VESTMAIL_DECRYPTION_FAILED,
    message: `${serviceName} VestMail 복호화에 실패했습니다. 비밀번호가 올바른지 확인하거나, ${fallbackUploadMessage}`
  });
}
