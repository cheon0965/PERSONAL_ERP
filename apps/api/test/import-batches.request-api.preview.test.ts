import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionType } from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
import { seedCollectableImportScenario } from './import-batches.request-api.shared';

test('POST /import-batches/:id/rows/:rowId/collect-preview returns the automatic preparation summary before promotion', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context);

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect-preview',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Imported from upload'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      importedRowId: 'imported-row-collect-1',
      occurredOn: '2026-03-12',
      title: 'Coffee beans',
      amountWon: 19_800,
      fundingAccountId: 'acc-1',
      fundingAccountName: 'Main checking',
      type: TransactionType.EXPENSE,
      requestedCategoryId: null,
      requestedCategoryName: null,
      autoPreparation: {
        matchedPlanItemId: 'plan-item-collect-1',
        matchedPlanItemTitle: 'Coffee beans budget',
        effectiveCategoryId: 'cat-1',
        effectiveCategoryName: 'Fuel',
        nextWorkflowStatus: 'READY_TO_POST',
        hasDuplicateSourceFingerprint: false,
        allowPlanItemMatch: true,
        decisionReasons: [
          '계획 항목 "Coffee beans budget"과 연결합니다.',
          '계획 항목 기준으로 "Fuel" 카테고리를 보완합니다.',
          '즉시 전표 준비 상태로 올립니다.'
        ]
      }
    });
    assert.equal(context.state.collectedTransactions.length, 3);
  } finally {
    await context.close();
  }
});
