import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CollectedTransactionStatus,
  ImportSourceKind,
  LiabilityRepaymentScheduleStatus,
  PlanItemStatus,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  buildImportRowFingerprint,
  seedCollectableImportScenario
} from './shared';

test('POST /import-batches/:id/rows/:rowId/collect creates a collected transaction from a parsed imported row', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context);
    context.state.liabilityRepaymentSchedules.push({
      id: 'liability-repayment-collect-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      liabilityAgreementId: 'liability-agreement-collect-1',
      dueDate: new Date('2026-03-11T00:00:00.000Z'),
      principalAmount: 18_000,
      interestAmount: 1_800,
      feeAmount: 0,
      totalAmount: 19_800,
      status: LiabilityRepaymentScheduleStatus.PLANNED,
      linkedPlanItemId: 'plan-item-collect-1',
      postedJournalEntryId: null,
      memo: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    const response = await context.request(
      '/import-batches/import-batch-collect/rows/imported-row-collect-1/collect',
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
      collectedTransaction: {
        id: 'ctx-4',
        businessDate: '2026-03-12',
        title: 'Coffee beans',
        type: TransactionType.EXPENSE,
        amountWon: 19_800,
        fundingAccountName: 'Main checking',
        categoryName: 'Fuel',
        sourceKind: 'IMPORT',
        postingStatus: 'READY_TO_POST',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null,
        matchedPlanItemId: 'plan-item-collect-1',
        matchedPlanItemTitle: 'Coffee beans budget'
      },
      preview: {
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
      }
    });
    assert.equal(context.state.collectedTransactions.length, 4);
    assert.deepEqual(context.state.collectedTransactions.at(-1), {
      id: 'ctx-4',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-import-collect',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: 'plan-item-collect-1',
      importBatchId: 'import-batch-collect',
      importedRowId: 'imported-row-collect-1',
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        occurredOn: '2026-03-12',
        amount: 19_800,
        title: 'Coffee beans'
      }),
      title: 'Coffee beans',
      occurredOn: new Date('2026-03-12T00:00:00.000Z'),
      amount: 19_800,
      status: CollectedTransactionStatus.READY_TO_POST,
      memo: 'Imported from upload',
      createdAt: context.state.collectedTransactions.at(-1)?.createdAt,
      updatedAt: context.state.collectedTransactions.at(-1)?.updatedAt
    });
    assert.equal(
      context.state.planItems.find(
        (candidate) => candidate.id === 'plan-item-collect-1'
      )?.status,
      PlanItemStatus.MATCHED
    );
    assert.equal(
      context.state.liabilityRepaymentSchedules.find(
        (candidate) => candidate.id === 'liability-repayment-collect-1'
      )?.status,
      LiabilityRepaymentScheduleStatus.MATCHED
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'collected_transaction.create' &&
          candidate.details.importBatchId === 'import-batch-collect' &&
          candidate.details.importedRowId === 'imported-row-collect-1' &&
          candidate.details.collectedTransactionId === 'ctx-4'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/:rowId/collect ignores expired bulk collection locks', async () => {
  const context = await createRequestTestContext();

  try {
    seedCollectableImportScenario(context, {
      batchId: 'import-batch-expired-lock-collect',
      rowId: 'imported-row-expired-lock-collect'
    });
    context.state.importBatchCollectionLocks.push({
      id: 'import-batch-collection-lock-expired-single',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      importBatchId: 'import-batch-old-bulk-job',
      jobId: 'import-batch-collection-job-expired-single',
      lockedByMembershipId: 'membership-2',
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(Date.now() - 120_000),
      updatedAt: new Date(Date.now() - 120_000)
    });

    const response = await context.request(
      '/import-batches/import-batch-expired-lock-collect/rows/imported-row-expired-lock-collect/collect',
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
    assert.equal(context.state.importBatchCollectionLocks.length, 0);
    assert.equal(
      context.state.collectedTransactions.at(-1)?.importedRowId,
      'imported-row-expired-lock-collect'
    );
  } finally {
    await context.close();
  }
});
