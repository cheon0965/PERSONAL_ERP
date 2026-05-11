import assert from 'node:assert/strict';
import test from 'node:test';
import type { ImportBatchItem } from '@personal-erp/contracts';
import { buildBalanceDiscrepancyBulkCollectConfirmationMessage } from '../src/features/imports/import-balance-discrepancy-confirmation';

test('bulk collect confirmation explains the first-dated balance discrepancy', () => {
  const message = buildBalanceDiscrepancyBulkCollectConfirmationMessage({
    batch: {
      fileName: 'woori-bank.html',
      fundingAccountName: '사업 운영 통장',
      balanceDiscrepancy: {
        importedBalanceWon: 2_050_000,
        referenceOccurredOn: '2026-03-13',
        referenceRowNumber: 2,
        ledgerBalanceWon: 2_000_000,
        differenceWon: 50_000
      }
    } satisfies Pick<
      ImportBatchItem,
      'balanceDiscrepancy' | 'fundingAccountName' | 'fileName'
    >,
    targetRowCount: 3
  });

  assert.ok(message);
  assert.match(message, /잔액 불일치가 있는 업로드 배치입니다/);
  assert.match(message, /최초일자: 2026-03-13/);
  assert.match(message, /차액: \+/);
  assert.match(message, /3건을 일괄 등록할까요/);
});

test('bulk collect confirmation is skipped when the batch balance is aligned', () => {
  assert.equal(
    buildBalanceDiscrepancyBulkCollectConfirmationMessage({
      batch: {
        fileName: 'manual.csv',
        fundingAccountName: null,
        balanceDiscrepancy: null
      } satisfies Pick<
        ImportBatchItem,
        'balanceDiscrepancy' | 'fundingAccountName' | 'fileName'
      >,
      targetRowCount: 1
    }),
    null
  );
});
