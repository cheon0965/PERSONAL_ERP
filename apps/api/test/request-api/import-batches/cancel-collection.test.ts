import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CollectedTransactionStatus,
  LiabilityRepaymentScheduleStatus,
  PlanItemStatus
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  pushCollectedTransaction,
  pushDraftPlanItem,
  pushImportBatch,
  pushImportedRow,
  pushOpenCollectingPeriod
} from './shared';

test('POST /import-batches/:id/cancel-collection cancels unposted collected transactions and restores matched plans', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-cancel-collection'
    });
    pushImportBatch(context, {
      id: 'import-batch-cancel-collection',
      fileName: 'cancel-collection.csv',
      fileHash: 'hash-cancel-collection',
      rowCount: 2
    });
    pushImportedRow(context, {
      id: 'imported-row-cancel-collection-1',
      batchId: 'import-batch-cancel-collection',
      rowNumber: 1
    });
    pushImportedRow(context, {
      id: 'imported-row-cancel-collection-2',
      batchId: 'import-batch-cancel-collection',
      rowNumber: 2
    });
    pushDraftPlanItem(context, {
      id: 'plan-item-cancel-collection',
      periodId: 'period-open-cancel-collection',
      status: PlanItemStatus.MATCHED
    });
    context.state.liabilityRepaymentSchedules.push({
      id: 'liability-repayment-cancel-collection',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      liabilityAgreementId: 'liability-agreement-cancel-collection',
      dueDate: new Date('2026-03-11T00:00:00.000Z'),
      principalAmount: 18_000,
      interestAmount: 1_800,
      feeAmount: 0,
      totalAmount: 19_800,
      status: LiabilityRepaymentScheduleStatus.MATCHED,
      linkedPlanItemId: 'plan-item-cancel-collection',
      postedJournalEntryId: null,
      memo: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    pushCollectedTransaction(context, {
      id: 'ctx-cancel-collection-1',
      periodId: 'period-open-cancel-collection',
      importBatchId: 'import-batch-cancel-collection',
      importedRowId: 'imported-row-cancel-collection-1',
      matchedPlanItemId: 'plan-item-cancel-collection',
      status: CollectedTransactionStatus.READY_TO_POST
    });
    pushCollectedTransaction(context, {
      id: 'ctx-cancel-collection-2',
      periodId: 'period-open-cancel-collection',
      importBatchId: 'import-batch-cancel-collection',
      importedRowId: 'imported-row-cancel-collection-2',
      matchedPlanItemId: null,
      status: CollectedTransactionStatus.REVIEWED
    });

    const response = await context.request(
      '/import-batches/import-batch-cancel-collection/cancel-collection',
      {
        method: 'POST',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      importBatchId: 'import-batch-cancel-collection',
      cancelledTransactionCount: 2,
      restoredPlanItemCount: 1,
      restoredLiabilityRepaymentScheduleCount: 1
    });
    assert.equal(
      context.state.collectedTransactions.some((candidate) =>
        ['ctx-cancel-collection-1', 'ctx-cancel-collection-2'].includes(
          candidate.id
        )
      ),
      false
    );
    assert.equal(
      context.state.planItems.find(
        (candidate) => candidate.id === 'plan-item-cancel-collection'
      )?.status,
      PlanItemStatus.DRAFT
    );
    assert.equal(
      context.state.liabilityRepaymentSchedules.find(
        (candidate) => candidate.id === 'liability-repayment-cancel-collection'
      )?.status,
      LiabilityRepaymentScheduleStatus.PLANNED
    );
    assert.ok(
      context.state.importBatches.some(
        (candidate) => candidate.id === 'import-batch-cancel-collection'
      )
    );
    assert.equal(
      context.state.importedRows.filter(
        (candidate) => candidate.batchId === 'import-batch-cancel-collection'
      ).length,
      2
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'import_batch.cancel' &&
          candidate.details.importBatchId ===
            'import-batch-cancel-collection' &&
          candidate.details.cancelledTransactionCount === 2
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/cancel-collection blocks batches with posted collected transactions', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-cancel-posted',
      fileName: 'cancel-posted.csv',
      fileHash: 'hash-cancel-posted'
    });
    pushImportedRow(context, {
      id: 'imported-row-cancel-posted',
      batchId: 'import-batch-cancel-posted'
    });
    pushCollectedTransaction(context, {
      id: 'ctx-cancel-posted',
      importBatchId: 'import-batch-cancel-posted',
      importedRowId: 'imported-row-cancel-posted',
      status: CollectedTransactionStatus.POSTED
    });

    const response = await context.request(
      '/import-batches/import-batch-cancel-posted/cancel-collection',
      {
        method: 'POST',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message: string }).message,
      '이미 전표 확정 또는 정정 흐름에 들어간 수집 거래가 있어 업로드 배치 등록을 전체 취소할 수 없습니다. 전표 화면에서 반전 또는 정정으로 처리해 주세요.'
    );
    assert.ok(
      context.state.collectedTransactions.some(
        (candidate) => candidate.id === 'ctx-cancel-posted'
      )
    );
  } finally {
    await context.close();
  }
});
