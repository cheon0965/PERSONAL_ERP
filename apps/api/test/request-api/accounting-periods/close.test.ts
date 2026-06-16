import assert from 'node:assert/strict';
import test from 'node:test';
import type { CloseAccountingPeriodResponse } from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';

test('POST /accounting-periods/:id/close locks the period and creates a closing snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-close-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-close-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.openingBalanceSnapshots.push({
      id: 'opening-close-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-close-1',
      sourceKind: OpeningBalanceSourceKind.INITIAL_SETUP,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'opening-close-line-1',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-close-1',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 3_000_000
      },
      {
        id: 'opening-close-line-2',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-close-1',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_000_000
      }
    );
    context.state.journalEntries.push({
      id: 'je-close-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-1',
      entryNumber: '202603-0001',
      entryDate: new Date('2026-03-12T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-2',
      status: 'POSTED',
      memo: 'Fuel refill',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-12T01:00:00.000Z'),
      updatedAt: new Date('2026-03-12T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-close-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 84_000,
          creditAmount: 0,
          description: 'Fuel refill'
        },
        {
          id: 'jel-close-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 84_000,
          description: 'Fuel refill'
        }
      ]
    });

    const response = await context.request(
      '/accounting-periods/period-close-1/close',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          note: '3월 월마감'
        }
      }
    );

    const body = response.body as CloseAccountingPeriodResponse;
    const closingLines = context.state.balanceSnapshotLines.filter(
      (line) => line.snapshotKind === 'CLOSING'
    );

    assert.equal(response.status, 201);
    assert.equal(body.period.status, AccountingPeriodStatus.LOCKED);
    assert.equal(context.state.closingSnapshots.length, 1);
    assert.equal(closingLines.length, 3);
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.toStatus,
      AccountingPeriodStatus.LOCKED
    );
    assert.equal(body.closingSnapshot.totalAssetAmount, 2_916_000);
    assert.equal(body.closingSnapshot.totalLiabilityAmount, 0);
    assert.equal(body.closingSnapshot.totalEquityAmount, 2_916_000);
    assert.equal(body.closingSnapshot.periodPnLAmount, -84_000);
    assert.equal(body.closingSnapshot.lines.length, 3);
    assert.deepEqual(
      body.closingSnapshot.lines.map((line) => ({
        accountSubjectCode: line.accountSubjectCode,
        fundingAccountName: line.fundingAccountName,
        balanceAmount: line.balanceAmount
      })),
      [
        {
          accountSubjectCode: '1010',
          fundingAccountName: 'Main checking',
          balanceAmount: 2_916_000
        },
        {
          accountSubjectCode: '3100',
          fundingAccountName: null,
          balanceAmount: 3_000_000
        },
        {
          accountSubjectCode: '5100',
          fundingAccountName: null,
          balanceAmount: 84_000
        }
      ]
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'accounting_period.close' &&
          candidate.details.periodId === 'period-close-1' &&
          candidate.details.closingSnapshotId === body.closingSnapshot.id
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/close blocks locking when unresolved collected transactions remain', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-close-pending-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.collectedTransactions.push({
      id: 'ctx-close-pending-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-pending-1',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: 'close-pending-1',
      title: '미확정 주유',
      occurredOn: new Date('2026-03-13T00:00:00.000Z'),
      amount: 84_000,
      status: CollectedTransactionStatus.REVIEWED,
      memo: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z')
    });
    context.state.collectedTransactions.push({
      id: 'ctx-close-pending-other-period',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-other',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: 'close-pending-other-period',
      title: 'Pending in another period',
      occurredOn: new Date('2026-04-01T00:00:00.000Z'),
      amount: 12_000,
      status: CollectedTransactionStatus.READY_TO_POST,
      memo: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });
    context.state.collectedTransactions.push({
      id: 'ctx-close-posted-same-period',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-pending-1',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: 'close-posted-same-period',
      title: 'Posted in same period',
      occurredOn: new Date('2026-03-14T00:00:00.000Z'),
      amount: 25_000,
      status: CollectedTransactionStatus.POSTED,
      memo: null,
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
      updatedAt: new Date('2026-03-14T00:00:00.000Z')
    });

    const response = await context.request(
      '/accounting-periods/period-close-pending-1/close',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          note: '미확정 거래가 있는 상태에서 월마감 시도'
        }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message: '미확정 수집 거래 1건이 남아 있어 운영 기간을 잠글 수 없습니다.',
      error: 'Bad Request'
    });
    assert.equal(context.state.closingSnapshots.length, 0);
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-close-pending-1'
      )?.status,
      AccountingPeriodStatus.OPEN
    );
  } finally {
    await context.close();
  }
});
