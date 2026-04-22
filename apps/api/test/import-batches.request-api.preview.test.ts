import assert from 'node:assert/strict';
import test from 'node:test';
import { ImportSourceKind, TransactionType } from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
import {
  buildImportRowFingerprint,
  pushCollectedTransaction,
  pushImportBatch,
  pushImportedRow,
  seedCollectableImportScenario
} from './import-batches.request-api.shared';

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

test('POST /import-batches/:id/rows/:rowId/collect-preview announces that a missing target month will be created during registration', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-missing-period-preview',
      fileName: 'missing-period-preview.csv',
      fileHash: 'hash-missing-period-preview'
    });
    pushImportedRow(context, {
      id: 'imported-row-missing-period-preview',
      batchId: 'import-batch-missing-period-preview',
      occurredOn: '2026-02-12',
      title: 'Auto-open preview',
      amount: 22_000
    });

    const response = await context.request(
      '/import-batches/import-batch-missing-period-preview/rows/imported-row-missing-period-preview/collect-preview',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(context.state.accountingPeriods.length, 0);
    const body = response.body as {
      autoPreparation: {
        willCreateTargetPeriod?: boolean;
        targetPeriodMonthLabel?: string;
        targetPeriodCreationReason?: string;
        decisionReasons: string[];
      };
    };

    assert.ok(
      body.autoPreparation.decisionReasons.includes(
        '2026-02 운영월이 없어 등록 과정에서 자동으로 추가합니다.'
      )
    );
    assert.deepEqual(
      {
        willCreateTargetPeriod: body.autoPreparation.willCreateTargetPeriod,
        targetPeriodMonthLabel: body.autoPreparation.targetPeriodMonthLabel,
        targetPeriodCreationReason:
          body.autoPreparation.targetPeriodCreationReason
      },
      {
        willCreateTargetPeriod: true,
        targetPeriodMonthLabel: '2026-02',
        targetPeriodCreationReason: 'INITIAL_SETUP'
      }
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect-preview blocks missing target months during monthly operation', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      periodId: 'period-current-month-preview',
      batchId: 'import-batch-missing-period-guard-preview',
      rowId: 'imported-row-missing-period-guard-preview',
      occurredOn: '2026-02-12',
      title: 'Past month preview',
      amount: 22_000
    });

    const response = await context.request(
      '/import-batches/import-batch-missing-period-guard-preview/rows/imported-row-missing-period-guard-preview/collect-preview',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message:
        '2026-02 운영월은 업로드 배치에서 자동으로 추가할 수 없습니다. 운영 중에는 월 운영 화면에서 최신 진행월을 먼저 열고 해당 월 거래만 등록해 주세요.',
      error: 'Bad Request'
    });
    assert.equal(context.state.accountingPeriods.length, 1);
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect-preview reports potential duplicates that need confirmation', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      title: 'Fuel refill',
      amount: 84_000
    });
    pushCollectedTransaction(context, {
      id: 'ctx-potential-duplicate-preview',
      periodId: 'period-open-import-collect',
      title: 'Fuel refill existing',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 84_000
    });

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect-preview',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(
      (
        response.body as {
          autoPreparation: {
            potentialDuplicateTransactionCount?: number;
          };
        }
      ).autoPreparation.potentialDuplicateTransactionCount,
      1
    );
    assert.ok(
      (
        response.body as {
          autoPreparation: {
            decisionReasons: string[];
          };
        }
      ).autoPreparation.decisionReasons.includes(
        '같은 거래일·금액·입출금 유형의 기존 거래 1건이 있어 확인 후 등록해야 합니다.'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect-preview ignores duplicate candidates from the same import batch', async () => {
  const context = await createRequestTestContext();

  try {
    const duplicateFingerprint = buildImportRowFingerprint({
      sourceKind: ImportSourceKind.MANUAL_UPLOAD,
      occurredOn: '2026-03-12',
      amount: 84_000,
      title: 'Fuel refill'
    });

    seedCollectableImportScenario(context, {
      title: 'Fuel refill',
      amount: 84_000,
      sourceFingerprint: duplicateFingerprint
    });
    pushCollectedTransaction(context, {
      id: 'ctx-same-batch-potential-duplicate-preview',
      periodId: 'period-open-import-collect',
      importBatchId: 'import-batch-collect',
      importedRowId: 'imported-row-same-batch-preview-existing',
      sourceFingerprint: duplicateFingerprint,
      title: 'Fuel refill existing from same batch',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 84_000
    });

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect-preview',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 201);
    const autoPreparation = (
      response.body as {
        autoPreparation: {
          hasDuplicateSourceFingerprint: boolean;
          potentialDuplicateTransactionCount?: number;
          nextWorkflowStatus: string;
          allowPlanItemMatch: boolean;
        };
      }
    ).autoPreparation;

    assert.equal(autoPreparation.hasDuplicateSourceFingerprint, false);
    assert.equal(autoPreparation.potentialDuplicateTransactionCount, undefined);
    assert.equal(autoPreparation.nextWorkflowStatus, 'READY_TO_POST');
    assert.equal(autoPreparation.allowPlanItemMatch, true);
  } finally {
    await context.close();
  }
});
