import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind
} from '@prisma/client';
import {
  buildSourceFingerprint,
  parseImportBatchContent
} from '../src/modules/import-batches/import-batch.policy';

test('buildSourceFingerprint normalizes description and source origin into a stable candidate key', () => {
  const left = buildSourceFingerprint({
    sourceKind: ImportSourceKind.BANK_CSV,
    occurredOn: '2026-03-02',
    amount: 4800,
    description: '  Coffee   Shop!!  ',
    sourceOrigin: 'Main-Checking'
  });
  const right = buildSourceFingerprint({
    sourceKind: ImportSourceKind.BANK_CSV,
    occurredOn: '2026-03-02',
    amount: 4800,
    description: 'coffee shop',
    sourceOrigin: 'main checking'
  });
  const changedOrigin = buildSourceFingerprint({
    sourceKind: ImportSourceKind.BANK_CSV,
    occurredOn: '2026-03-02',
    amount: 4800,
    description: 'coffee shop',
    sourceOrigin: 'reserve checking'
  });

  assert.equal(left, right);
  assert.notEqual(left, changedOrigin);
  assert.match(left, /^sf:v1:[a-f0-9]{64}$/);
});

test('parseImportBatchContent assigns source fingerprints only to successfully parsed rows', () => {
  const parsed = parseImportBatchContent({
    sourceKind: ImportSourceKind.MANUAL_UPLOAD,
    content: [
      'date,title,amount,account_name',
      '2026-03-02,Coffee,4800,Main Checking',
      'not-a-date,Broken,15000,Main Checking'
    ].join('\n')
  });

  assert.equal(parsed.rowCount, 2);
  assert.equal(parsed.parseStatus, ImportBatchParseStatus.PARTIAL);
  assert.equal(parsed.rows[0]?.parseStatus, ImportedRowParseStatus.PARSED);
  assert.match(parsed.rows[0]?.sourceFingerprint ?? '', /^sf:v1:[a-f0-9]{64}$/);
  assert.equal(parsed.rows[1]?.parseStatus, ImportedRowParseStatus.FAILED);
  assert.equal(parsed.rows[1]?.sourceFingerprint, null);
});

test('parseImportBatchContent uses source-specific origin columns when building fingerprints', () => {
  const parsed = parseImportBatchContent({
    sourceKind: ImportSourceKind.CARD_EXCEL,
    content: [
      'approved_at,merchant,amount,card_name',
      '2026-03-02,Coffee,4800,Biz Card'
    ].join('\n')
  });
  const expected = buildSourceFingerprint({
    sourceKind: ImportSourceKind.CARD_EXCEL,
    occurredOn: '2026-03-02',
    amount: 4800,
    description: 'Coffee',
    sourceOrigin: 'Biz Card'
  });

  assert.equal(parsed.parseStatus, ImportBatchParseStatus.COMPLETED);
  assert.equal(parsed.rows[0]?.sourceFingerprint, expected);
});
