import assert from 'node:assert/strict';
import test from 'node:test';
import { CategoryKind } from '@prisma/client';
import {
  readGenericAccountSubjectCode,
  STANDARD_ACCOUNT_SUBJECT_CATALOG,
  STANDARD_ACCOUNT_SUBJECT_CODES
} from '../../../src/common/prisma/standard-account-subject.catalog';

test('standard account subject catalog exposes the complete system chart', () => {
  assert.deepEqual(
    STANDARD_ACCOUNT_SUBJECT_CATALOG.map((subject) => subject.code),
    [
      '1010',
      '2100',
      '3100',
      '4100',
      '4110',
      '4190',
      '5100',
      '5110',
      '5120',
      '5130',
      '5140',
      '5150',
      '5160',
      '5170',
      '5180',
      '5190',
      '5200',
      '5210',
      '5220'
    ]
  );
  assert.equal(
    new Set(STANDARD_ACCOUNT_SUBJECT_CATALOG.map((subject) => subject.code))
      .size,
    STANDARD_ACCOUNT_SUBJECT_CATALOG.length
  );
  assert.ok(
    STANDARD_ACCOUNT_SUBJECT_CATALOG.every((subject) => subject.isSystem)
  );
});

test('generic category mappings resolve only income and expense subjects', () => {
  assert.equal(
    readGenericAccountSubjectCode(CategoryKind.INCOME),
    STANDARD_ACCOUNT_SUBJECT_CODES.OPERATING_INCOME
  );
  assert.equal(
    readGenericAccountSubjectCode(CategoryKind.EXPENSE),
    STANDARD_ACCOUNT_SUBJECT_CODES.OPERATING_EXPENSE
  );
  assert.equal(readGenericAccountSubjectCode(CategoryKind.TRANSFER), null);
});
