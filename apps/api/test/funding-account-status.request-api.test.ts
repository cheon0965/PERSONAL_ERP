import assert from 'node:assert/strict';
import test from 'node:test';
import type { FundingAccountOverviewResponse } from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  PlanItemStatus
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('GET /funding-account-status/summary returns scoped account metrics for the selected period and account', async () => {
  const context = await createRequestTestContext();

  try {
    seedFundingAccountStatusFixture(context);

    const response = await context.request(
      '/funding-account-status/summary?periodId=period-funding-open-1&fundingAccountId=acc-1&basis=COLLECTED_TRANSACTIONS',
      {
        headers: context.authHeaders()
      }
    );

    const body = response.body as FundingAccountOverviewResponse;
    const selectedAccount = body.accounts.find(
      (account) => account.id === 'acc-1'
    );

    assert.equal(response.status, 200);
    assert.equal(body.period.id, 'period-funding-open-1');
    assert.equal(body.basis, 'COLLECTED_TRANSACTIONS');
    assert.equal(body.selectedFundingAccountId, 'acc-1');
    assert.equal(body.totals.fundingAccountCount, 1);
    assert.equal(body.totals.openingBalanceWon, 2_000_000);
    assert.equal(body.totals.incomeWon, 3_000_000);
    assert.equal(body.totals.expenseWon, 84_000);
    assert.equal(body.totals.netFlowWon, 2_916_000);
    assert.equal(body.totals.basisClosingBalanceWon, 4_916_000);
    assert.equal(body.totals.remainingPlannedExpenseWon, 75_000);
    assert.equal(body.totals.expectedClosingBalanceWon, 4_841_000);
    assert.equal(body.totals.transactionCount, 2);
    assert.equal(body.totals.pendingTransactionCount, 1);
    assert.equal(body.totals.postedTransactionCount, 1);
    assert.equal(selectedAccount?.name, 'Main checking');
    assert.equal(selectedAccount?.lastActivityOn, '2026-03-25');
    assert.deepEqual(
      body.transactions.map((transaction) => transaction.id),
      ['ctx-seed-1', 'ctx-seed-2']
    );
    assert.equal(
      body.transactions.some(
        (transaction) => transaction.fundingAccountId !== 'acc-1'
      ),
      false
    );
    assert.equal(
      body.categoryBreakdown.some(
        (category) => category.categoryName === 'Other category'
      ),
      false
    );
    assert.equal(
      body.warnings.some((warning) => warning.includes('Main checking')),
      true
    );
  } finally {
    await context.close();
  }
});

type RequestContext = Awaited<ReturnType<typeof createRequestTestContext>>;

function seedFundingAccountStatusFixture(context: RequestContext) {
  context.state.accountingPeriods.push({
    id: 'period-funding-open-1',
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
    id: 'period-history-funding-open-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-funding-open-1',
    fromStatus: null,
    toStatus: AccountingPeriodStatus.OPEN,
    eventType: 'OPEN',
    reason: '3월 운영 시작',
    actorType: AuditActorType.TENANT_MEMBERSHIP,
    actorMembershipId: 'membership-1',
    changedAt: new Date('2026-03-01T00:00:00.000Z')
  });
  context.state.openingBalanceSnapshots.push({
    id: 'opening-funding-open-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    effectivePeriodId: 'period-funding-open-1',
    sourceKind: 'CARRY_FORWARD',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: 'membership-1'
  });
  context.state.balanceSnapshotLines.push({
    id: 'balance-funding-opening-1',
    snapshotKind: 'OPENING',
    openingSnapshotId: 'opening-funding-open-1',
    closingSnapshotId: null,
    accountSubjectId: 'as-1-1010',
    fundingAccountId: 'acc-1',
    balanceAmount: 2_000_000
  });

  for (const transaction of context.state.collectedTransactions) {
    if (transaction.tenantId !== 'tenant-1') {
      continue;
    }

    transaction.periodId = 'period-funding-open-1';
    if (transaction.id === 'ctx-seed-2') {
      transaction.status = CollectedTransactionStatus.READY_TO_POST;
    }
  }

  context.state.planItems.push({
    id: 'plan-funding-open-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-funding-open-1',
    recurringRuleId: 'rr-seed-1',
    ledgerTransactionTypeId: 'ltt-1-expense',
    fundingAccountId: 'acc-1',
    categoryId: 'cat-1c',
    title: 'Phone bill',
    plannedAmount: 75_000,
    plannedDate: new Date('2026-03-28T00:00:00.000Z'),
    status: PlanItemStatus.DRAFT,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z')
  });
}
