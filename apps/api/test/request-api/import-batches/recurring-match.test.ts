import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CollectedTransactionStatus,
  PlanItemStatus,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  pushCollectedTransaction,
  seedCollectableImportScenario
} from './shared';

test('POST /import-batches/:id/rows/:rowId/collect absorbs a recurring collected transaction that was already created from a matched plan item', async () => {
  const context = await createRequestTestContext();

  try {
    const seeded = seedCollectableImportScenario(context, {
      periodId: 'period-open-recurring-absorb',
      batchId: 'import-batch-recurring-absorb',
      rowId: 'imported-row-recurring-absorb',
      planItemId: 'plan-item-recurring-absorb',
      title: 'Phone bill',
      amount: 75_000,
      planItemTitle: 'Phone bill'
    });

    context.state.planItems = context.state.planItems.map((candidate) =>
      candidate.id === seeded.planItem.id
        ? {
            ...candidate,
            status: PlanItemStatus.MATCHED,
            updatedAt: new Date()
          }
        : candidate
    );

    pushCollectedTransaction(context, {
      id: 'ctx-recurring-existing',
      periodId: seeded.period.id,
      matchedPlanItemId: seeded.planItem.id,
      title: 'Phone bill',
      amount: 75_000,
      occurredOn: new Date('2026-03-11T00:00:00.000Z'),
      status: CollectedTransactionStatus.READY_TO_POST
    });

    const response = await context.request(
      '/import-batches/import-batch-recurring-absorb/rows/imported-row-recurring-absorb/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Imported recurring bill'
        }
      }
    );

    assert.equal(response.status, 201);
    assert.equal(
      (response.body as { collectedTransaction: { id: string } })
        .collectedTransaction.id,
      'ctx-recurring-existing'
    );
    assert.equal(
      context.state.collectedTransactions.filter(
        (candidate) => candidate.matchedPlanItemId === seeded.planItem.id
      ).length,
      1
    );
    assert.deepEqual(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-recurring-existing'
      ),
      {
        id: 'ctx-recurring-existing',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: seeded.period.id,
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: seeded.planItem.id,
        importBatchId: seeded.batch.id,
        importedRowId: seeded.row.id,
        sourceFingerprint: seeded.fingerprint,
        title: 'Phone bill',
        occurredOn: new Date('2026-03-12T00:00:00.000Z'),
        amount: 75_000,
        status: CollectedTransactionStatus.READY_TO_POST,
        memo: 'Imported recurring bill',
        createdAt: context.state.collectedTransactions.find(
          (candidate) => candidate.id === 'ctx-recurring-existing'
        )?.createdAt,
        updatedAt: context.state.collectedTransactions.find(
          (candidate) => candidate.id === 'ctx-recurring-existing'
        )?.updatedAt
      }
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect returns 409 when the matched recurring transaction is already linked to another import row', async () => {
  const context = await createRequestTestContext();

  try {
    const seeded = seedCollectableImportScenario(context, {
      periodId: 'period-open-recurring-conflict',
      batchId: 'import-batch-recurring-conflict',
      rowId: 'imported-row-recurring-conflict',
      planItemId: 'plan-item-recurring-conflict',
      title: 'Streaming bill',
      amount: 21_000,
      planItemTitle: 'Streaming bill'
    });

    context.state.planItems = context.state.planItems.map((candidate) =>
      candidate.id === seeded.planItem.id
        ? {
            ...candidate,
            status: PlanItemStatus.MATCHED,
            updatedAt: new Date()
          }
        : candidate
    );

    pushCollectedTransaction(context, {
      id: 'ctx-recurring-conflict',
      periodId: seeded.period.id,
      matchedPlanItemId: seeded.planItem.id,
      title: 'Streaming bill',
      amount: 21_000,
      occurredOn: new Date('2026-03-11T00:00:00.000Z'),
      status: CollectedTransactionStatus.READY_TO_POST
    });
    context.state.simulateCollectedTransactionAlreadyLinkedOnNextImportClaimId =
      'ctx-recurring-conflict';

    const response = await context.request(
      '/import-batches/import-batch-recurring-conflict/rows/imported-row-recurring-conflict/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          memo: 'Retry imported recurring bill'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message:
        '이미 다른 업로드 행과 연결된 반복 수집 거래입니다. 다시 새로고침해 주세요.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.collectedTransactions.filter(
        (candidate) => candidate.matchedPlanItemId === seeded.planItem.id
      ).length,
      1
    );
  } finally {
    await context.close();
  }
});
