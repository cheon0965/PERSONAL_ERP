import assert from 'node:assert/strict';
import test from 'node:test';
import type { ImportBatchCollectionJobItem } from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  ImportBatchParseStatus,
  ImportSourceKind,
  TransactionType
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import {
  buildImportRowFingerprint,
  pushImportBatch,
  pushImportedRow,
  pushOpenCollectingPeriod
} from './shared';
import { readCollectionJobUntilDone } from './batch-action-fixtures';

test('POST /import-batches/:id/rows/collect bulk-collects selected rows and infers income or expense from parsed direction', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-bulk-collect',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank.pdf',
      fileHash: 'hash-bulk-collect',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-deposit',
      batchId: 'import-batch-bulk-collect',
      rowNumber: 1,
      occurredOn: '2026-03-12',
      title: '입금 테스트',
      amount: 50_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-12',
        amount: 50_000,
        title: '입금 테스트'
      }),
      parsed: {
        occurredOn: '2026-03-12',
        title: '입금 테스트',
        amount: 50_000,
        direction: 'DEPOSIT',
        balanceAfter: 250_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-withdrawal',
      batchId: 'import-batch-bulk-collect',
      rowNumber: 2,
      occurredOn: '2026-03-13',
      title: '출금 테스트',
      amount: 17_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-13',
        amount: 17_000,
        title: '출금 테스트'
      }),
      parsed: {
        occurredOn: '2026-03-13',
        title: '출금 테스트',
        amount: 17_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 233_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-collect/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-deposit', 'imported-row-withdrawal'],
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    assert.equal(startedJob.importBatchId, 'import-batch-bulk-collect');
    assert.equal(startedJob.requestedRowCount, 2);

    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-bulk-collect',
      startedJob.id
    );
    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.equal(completedJob.processedRowCount, 2);
    assert.equal(completedJob.succeededCount, 2);
    assert.equal(completedJob.failedCount, 0);
    assert.deepEqual(
      completedJob.results.map((result) => ({
        importedRowId: result.importedRowId,
        rowNumber: result.rowNumber,
        status: result.status,
        collectedTransactionId: result.collectedTransactionId,
        message: result.message
      })),
      [
        {
          importedRowId: 'imported-row-deposit',
          rowNumber: 1,
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-4',
          message:
            '2026-03 운영 시작 전 기초 입력으로 운영월을 자동 생성하고 등록했습니다.'
        },
        {
          importedRowId: 'imported-row-withdrawal',
          rowNumber: 2,
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-5',
          message: '카테고리 보완 전까지 검토 상태로 저장합니다.'
        }
      ]
    );
    assert.equal(context.state.collectedTransactions.length, 5);
    assert.deepEqual(context.state.accountingPeriods, [
      {
        id: 'period-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 3,
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        status: 'OPEN',
        nextJournalEntrySequence: 1,
        openedAt: context.state.accountingPeriods[0]?.openedAt,
        lockedAt: null,
        createdAt: context.state.accountingPeriods[0]?.createdAt,
        updatedAt: context.state.accountingPeriods[0]?.updatedAt
      }
    ]);
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-4'
      )?.ledgerTransactionTypeId,
      'ltt-1-income'
    );
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-5'
      )?.ledgerTransactionTypeId,
      'ltt-1-expense'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect queues only current operating month rows when mixed-period rows are selected', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-current-upload',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z')
    });
    pushImportBatch(context, {
      id: 'import-batch-current-period-only',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'mixed-months.pdf',
      fileHash: 'hash-current-period-only',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-current-period',
      batchId: 'import-batch-current-period-only',
      rowNumber: 1,
      occurredOn: '2026-03-12',
      title: '현재 운영월 출금',
      amount: 17_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-12',
        amount: 17_000,
        title: '현재 운영월 출금'
      }),
      parsed: {
        occurredOn: '2026-03-12',
        title: '현재 운영월 출금',
        amount: 17_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 233_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-past-period',
      batchId: 'import-batch-current-period-only',
      rowNumber: 2,
      occurredOn: '2026-02-28',
      title: '이전월 출금',
      amount: 9_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-02-28',
        amount: 9_000,
        title: '이전월 출금'
      }),
      parsed: {
        occurredOn: '2026-02-28',
        title: '이전월 출금',
        amount: 9_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 242_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-current-period-only/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-current-period', 'imported-row-past-period'],
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    assert.equal(startedJob.requestedRowCount, 1);

    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-current-period-only',
      startedJob.id
    );
    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.equal(completedJob.processedRowCount, 1);
    assert.equal(completedJob.succeededCount, 1);
    assert.equal(completedJob.failedCount, 0);
    assert.deepEqual(
      completedJob.results.map((result) => result.importedRowId),
      ['imported-row-current-period']
    );
    assert.equal(
      context.state.collectedTransactions.some(
        (transaction) =>
          transaction.importedRowId === 'imported-row-past-period'
      ),
      false
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect applies a shared type and category to selected rows', async () => {
  const context = await createRequestTestContext();

  try {
    pushImportBatch(context, {
      id: 'import-batch-bulk-classify',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank-classify.pdf',
      fileHash: 'hash-bulk-classify',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-classify-1',
      batchId: 'import-batch-bulk-classify',
      rowNumber: 1,
      occurredOn: '2026-03-12',
      title: '주유소 A',
      amount: 50_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-12',
        amount: 50_000,
        title: '주유소 A'
      }),
      parsed: {
        occurredOn: '2026-03-12',
        title: '주유소 A',
        amount: 50_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 250_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-classify-2',
      batchId: 'import-batch-bulk-classify',
      rowNumber: 2,
      occurredOn: '2026-03-13',
      title: '주유소 B',
      amount: 47_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-13',
        amount: 47_000,
        title: '주유소 B'
      }),
      parsed: {
        occurredOn: '2026-03-13',
        title: '주유소 B',
        amount: 47_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 203_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-classify/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-classify-1', 'imported-row-classify-2'],
          type: TransactionType.EXPENSE,
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1'
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-bulk-classify',
      startedJob.id
    );

    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.deepEqual(
      completedJob.results.map((result) => result.message),
      [
        '2026-03 운영 시작 전 기초 입력으로 운영월을 자동 생성하고 등록했습니다.',
        '즉시 전표 준비 상태로 올립니다.'
      ]
    );
    assert.deepEqual(
      context.state.collectedTransactions
        .filter((candidate) => ['ctx-4', 'ctx-5'].includes(candidate.id))
        .map((candidate) => ({
          ledgerTransactionTypeId: candidate.ledgerTransactionTypeId,
          categoryId: candidate.categoryId,
          status: candidate.status
        })),
      [
        {
          ledgerTransactionTypeId: 'ltt-1-expense',
          categoryId: 'cat-1',
          status: CollectedTransactionStatus.READY_TO_POST
        },
        {
          ledgerTransactionTypeId: 'ltt-1-expense',
          categoryId: 'cat-1',
          status: CollectedTransactionStatus.READY_TO_POST
        }
      ]
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect applies category and memo by inferred transaction type', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-bulk-type-options'
    });
    pushImportBatch(context, {
      id: 'import-batch-bulk-type-options',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank-type-options.pdf',
      fileHash: 'hash-bulk-type-options',
      fundingAccountId: 'acc-1',
      rowCount: 2,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-type-options-income',
      batchId: 'import-batch-bulk-type-options',
      rowNumber: 1,
      occurredOn: '2026-03-24',
      title: '정산 입금',
      amount: 140_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-24',
        amount: 140_000,
        title: '정산 입금'
      }),
      parsed: {
        occurredOn: '2026-03-24',
        title: '정산 입금',
        amount: 140_000,
        direction: 'DEPOSIT',
        balanceAfter: 370_000
      }
    });
    pushImportedRow(context, {
      id: 'imported-row-type-options-expense',
      batchId: 'import-batch-bulk-type-options',
      rowNumber: 2,
      occurredOn: '2026-03-25',
      title: '주유 결제',
      amount: 60_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-25',
        amount: 60_000,
        title: '주유 결제'
      }),
      parsed: {
        occurredOn: '2026-03-25',
        title: '주유 결제',
        amount: 60_000,
        direction: 'WITHDRAWAL',
        balanceAfter: 310_000
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-type-options/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: [
            'imported-row-type-options-income',
            'imported-row-type-options-expense'
          ],
          fundingAccountId: 'acc-1',
          categoryId: 'cat-1c',
          memo: '공통 메모',
          typeOptions: [
            {
              type: TransactionType.INCOME,
              categoryId: 'cat-1b',
              memo: '수입 일괄 메모'
            },
            {
              type: TransactionType.EXPENSE,
              categoryId: 'cat-1',
              memo: '지출 일괄 메모'
            }
          ]
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-bulk-type-options',
      startedJob.id
    );

    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.deepEqual(
      context.state.collectedTransactions
        .filter((candidate) => ['ctx-4', 'ctx-5'].includes(candidate.id))
        .map((candidate) => ({
          ledgerTransactionTypeId: candidate.ledgerTransactionTypeId,
          categoryId: candidate.categoryId,
          memo: candidate.memo,
          status: candidate.status
        })),
      [
        {
          ledgerTransactionTypeId: 'ltt-1-income',
          categoryId: 'cat-1b',
          memo: '수입 일괄 메모',
          status: CollectedTransactionStatus.READY_TO_POST
        },
        {
          ledgerTransactionTypeId: 'ltt-1-expense',
          categoryId: 'cat-1',
          memo: '지출 일괄 메모',
          status: CollectedTransactionStatus.READY_TO_POST
        }
      ]
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect maps 승인취소 행 to the adjustment transaction type', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-bulk-collect-reversal'
    });
    pushImportBatch(context, {
      id: 'import-batch-bulk-collect-reversal',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank-reversal.pdf',
      fileHash: 'hash-bulk-collect-reversal',
      fundingAccountId: 'acc-1',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-reversal',
      batchId: 'import-batch-bulk-collect-reversal',
      rowNumber: 1,
      occurredOn: '2026-03-20',
      title: '기분좋은self주유',
      amount: 140_000,
      sourceFingerprint: buildImportRowFingerprint({
        sourceKind: ImportSourceKind.IM_BANK_PDF,
        occurredOn: '2026-03-20',
        amount: 140_000,
        title: '기분좋은self주유'
      }),
      parsed: {
        occurredOn: '2026-03-20',
        title: '기분좋은self주유',
        amount: 140_000,
        direction: 'REVERSAL',
        directionLabel: '승인취소',
        collectTypeHint: 'REVERSAL',
        balanceAfter: 18_667_536,
        reversalTargetRowNumber: 3
      }
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-collect-reversal/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-reversal'],
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 202);
    const startedJob = response.body as ImportBatchCollectionJobItem;
    const completedJob = await readCollectionJobUntilDone(
      context,
      'import-batch-bulk-collect-reversal',
      startedJob.id
    );
    assert.equal(completedJob.status, 'SUCCEEDED');
    assert.equal(completedJob.requestedRowCount, 1);
    assert.equal(completedJob.succeededCount, 1);
    assert.equal(completedJob.failedCount, 0);
    assert.deepEqual(
      completedJob.results.map((result) => ({
        importedRowId: result.importedRowId,
        rowNumber: result.rowNumber,
        status: result.status,
        collectedTransactionId: result.collectedTransactionId,
        message: result.message
      })),
      [
        {
          importedRowId: 'imported-row-reversal',
          rowNumber: 1,
          status: 'COLLECTED',
          collectedTransactionId: 'ctx-4',
          message: '승인취소 거래라 카테고리 없이도 전표 준비 상태로 올립니다.'
        }
      ]
    );
    assert.equal(
      context.state.collectedTransactions.find(
        (candidate) => candidate.id === 'ctx-4'
      )?.ledgerTransactionTypeId,
      'ltt-1-adjustment'
    );
  } finally {
    await context.close();
  }
});

test('POST /import-batches/:id/rows/collect blocks another workspace bulk job while one is active', async () => {
  const context = await createRequestTestContext();

  try {
    pushOpenCollectingPeriod(context, {
      id: 'period-open-bulk-collect-lock'
    });
    pushImportBatch(context, {
      id: 'import-batch-bulk-collect-lock',
      sourceKind: ImportSourceKind.IM_BANK_PDF,
      fileName: 'im-bank-lock.pdf',
      fileHash: 'hash-bulk-collect-lock',
      fundingAccountId: 'acc-1',
      rowCount: 1,
      parseStatus: ImportBatchParseStatus.COMPLETED
    });
    pushImportedRow(context, {
      id: 'imported-row-lock',
      batchId: 'import-batch-bulk-collect-lock',
      rowNumber: 1,
      occurredOn: '2026-03-22',
      title: '동시 작업 테스트',
      amount: 10_000
    });
    context.state.importBatchCollectionLocks.push({
      id: 'import-batch-collection-lock-existing',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      importBatchId: 'import-batch-other-active',
      jobId: 'import-batch-collection-job-active',
      lockedByMembershipId: 'membership-2',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await context.request(
      '/import-batches/import-batch-bulk-collect-lock/rows/collect',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          rowIds: ['imported-row-lock'],
          fundingAccountId: 'acc-1'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      (response.body as { message: string }).message,
      '현재 워크스페이스에서 다른 업로드 배치 일괄 등록이 진행 중입니다. 완료 후 다시 시도해 주세요.'
    );
  } finally {
    await context.close();
  }
});
