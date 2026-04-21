import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  PlanItemStatus
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('GET /dashboard/summary returns a workspace-period operational summary', async () => {
  const context = await createRequestTestContext();

  try {
    seedReportingPeriods(context);

    const response = await context.request('/dashboard/summary', {
      headers: context.authHeaders()
    });

    const summary = response.body as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(summary.period instanceof Object, true);
    assert.equal(
      (summary.period as Record<string, unknown>).monthLabel,
      '2026-03'
    );
    assert.equal(summary.basisStatus, 'LIVE_OPERATIONS');
    assert.equal(summary.actualBalanceWon, 5_500_000);
    assert.equal(summary.confirmedIncomeWon, 3_000_000);
    assert.equal(summary.confirmedExpenseWon, 84_000);
    assert.equal(summary.remainingPlannedExpenseWon, 75_000);
    assert.equal(summary.expectedMonthEndBalanceWon, 5_425_000);
    assert.equal(summary.safetySurplusWon, 4_925_000);
    assert.equal(
      (summary.officialComparison as Record<string, unknown>).monthLabel,
      '2026-02'
    );
    assert.equal(Array.isArray(summary.trend), true);
    assert.equal('accounts' in summary, false);
    assert.equal('transactions' in summary, false);
    assert.equal('recurringRules' in summary, false);
  } finally {
    await context.close();
  }
});

test('GET /forecast/monthly returns a workspace-period forecast for the selected period', async () => {
  const context = await createRequestTestContext();

  try {
    seedReportingPeriods(context);

    const response = await context.request(
      '/forecast/monthly?periodId=period-report-open-1',
      {
        headers: context.authHeaders()
      }
    );

    const forecast = response.body as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(
      (forecast.period as Record<string, unknown>).monthLabel,
      '2026-03'
    );
    assert.equal(forecast.basisStatus, 'LIVE_OPERATIONS');
    assert.equal(forecast.actualBalanceWon, 5_500_000);
    assert.equal(forecast.confirmedIncomeWon, 3_000_000);
    assert.equal(forecast.expectedIncomeWon, 0);
    assert.equal(forecast.confirmedExpenseWon, 84_000);
    assert.equal(forecast.remainingPlannedExpenseWon, 75_000);
    assert.equal(forecast.sinkingFundWon, 210_000);
    assert.equal(forecast.minimumReserveWon, 500_000);
    assert.equal(forecast.expectedMonthEndBalanceWon, 5_215_000);
    assert.equal(forecast.safetySurplusWon, 4_715_000);
    assert.equal(Array.isArray(forecast.notes), true);
    assert.equal('accounts' in forecast, false);
    assert.equal('transactions' in forecast, false);
    assert.equal('recurringRules' in forecast, false);
  } finally {
    await context.close();
  }
});

test('GET /dashboard/summary and /forecast/monthly return null when no accounting period exists', async () => {
  const context = await createRequestTestContext();

  try {
    const [dashboardResponse, forecastResponse] = await Promise.all([
      context.request('/dashboard/summary', {
        headers: context.authHeaders()
      }),
      context.request('/forecast/monthly', {
        headers: context.authHeaders()
      })
    ]);

    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboardResponse.body, null);
    assert.equal(forecastResponse.status, 200);
    assert.equal(forecastResponse.body, null);
  } finally {
    await context.close();
  }
});

test('GET /dashboard/summary and /forecast/monthly use imported balanceAfter as the live actual balance anchor', async () => {
  const context = await createRequestTestContext();

  try {
    seedReportingPeriods(context);
    context.state.importBatches.push({
      id: 'batch-report-anchor-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-open-1',
      sourceKind: 'IM_BANK_PDF',
      fileName: 'dashboard-anchor.pdf',
      fileHash: 'file-hash-dashboard-anchor-1',
      fundingAccountId: 'acc-1',
      rowCount: 1,
      parseStatus: 'COMPLETED',
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-26T00:00:00.000Z')
    });
    context.state.importedRows.push({
      id: 'row-report-anchor-1',
      batchId: 'batch-report-anchor-1',
      rowNumber: 88,
      rawPayload: {
        parsed: {
          occurredOn: '2026-03-26',
          occurredAt: '2026-03-26T18:30:00+09:00',
          title: 'Anchor deposit',
          amount: 4_500_000,
          signedAmount: 4_500_000,
          balanceAfter: 5_120_000,
          direction: 'DEPOSIT'
        }
      },
      parseStatus: 'PARSED',
      parseError: null,
      sourceFingerprint: 'sf-report-anchor-1'
    });
    context.state.collectedTransactions.push({
      id: 'ctx-report-anchor-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-open-1',
      ledgerTransactionTypeId: 'ltt-1-income',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1b',
      matchedPlanItemId: null,
      importBatchId: 'batch-report-anchor-1',
      importedRowId: 'row-report-anchor-1',
      sourceFingerprint: 'sf-report-anchor-1',
      title: 'Anchor deposit',
      occurredOn: new Date('2026-03-26T00:00:00.000Z'),
      amount: 4_500_000,
      status: 'READY_TO_POST',
      memo: null,
      createdAt: new Date('2026-03-26T00:30:00.000Z'),
      updatedAt: new Date('2026-03-26T00:30:00.000Z')
    });
    context.state.collectedTransactions.push({
      id: 'ctx-report-after-anchor-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-open-1',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: null,
      title: 'After anchor cash expense',
      occurredOn: new Date('2026-03-27T00:00:00.000Z'),
      amount: 20_000,
      status: 'READY_TO_POST',
      memo: null,
      createdAt: new Date('2026-03-27T00:30:00.000Z'),
      updatedAt: new Date('2026-03-27T00:30:00.000Z')
    });

    const [dashboardResponse, forecastResponse] = await Promise.all([
      context.request('/dashboard/summary', {
        headers: context.authHeaders()
      }),
      context.request('/forecast/monthly?periodId=period-report-open-1', {
        headers: context.authHeaders()
      })
    ]);

    const dashboard = dashboardResponse.body as Record<string, unknown>;
    const forecast = forecastResponse.body as Record<string, unknown>;

    assert.equal(dashboardResponse.status, 200);
    assert.equal(forecastResponse.status, 200);
    assert.equal(dashboard.actualBalanceWon, 8_600_000);
    assert.equal(forecast.actualBalanceWon, 8_600_000);
  } finally {
    await context.close();
  }
});

function seedReportingPeriods(
  context: Awaited<ReturnType<typeof createRequestTestContext>>
) {
  context.state.accountingPeriods.push(
    {
      id: 'period-report-locked-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-02-01T00:00:00.000Z'),
      lockedAt: new Date('2026-02-28T15:00:00.000Z'),
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-28T15:00:00.000Z')
    },
    {
      id: 'period-report-open-1',
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
    }
  );
  context.state.periodStatusHistory.push(
    {
      id: 'period-history-report-locked-open',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-locked-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '2월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-02-01T00:00:00.000Z')
    },
    {
      id: 'period-history-report-locked-lock',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-locked-1',
      fromStatus: AccountingPeriodStatus.OPEN,
      toStatus: AccountingPeriodStatus.LOCKED,
      eventType: 'LOCK',
      reason: '2월 마감',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-02-28T15:00:00.000Z')
    },
    {
      id: 'period-history-report-open-open',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-open-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    }
  );
  context.state.openingBalanceSnapshots.push({
    id: 'opening-report-open-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    effectivePeriodId: 'period-report-open-1',
    sourceKind: 'CARRY_FORWARD',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: 'membership-1'
  });
  context.state.closingSnapshots.push({
    id: 'closing-report-locked-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-report-locked-1',
    lockedAt: new Date('2026-02-28T15:00:00.000Z'),
    totalAssetAmount: 5_200_000,
    totalLiabilityAmount: 0,
    totalEquityAmount: 5_200_000,
    periodPnLAmount: 120_000,
    createdAt: new Date('2026-02-28T15:00:00.000Z')
  });
  context.state.balanceSnapshotLines.push({
    id: 'balance-report-locked-1',
    snapshotKind: 'CLOSING',
    openingSnapshotId: null,
    closingSnapshotId: 'closing-report-locked-1',
    accountSubjectId: 'as-1-1010',
    fundingAccountId: 'acc-1',
    balanceAmount: 5_200_000
  });
  context.state.journalEntries.push(
    {
      id: 'je-report-income-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-open-1',
      entryNumber: '202603-0001',
      entryDate: new Date('2026-03-25T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-1',
      reversesJournalEntryId: null,
      correctsJournalEntryId: null,
      correctionReason: null,
      status: 'POSTED',
      memo: 'March salary',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-25T01:00:00.000Z'),
      updatedAt: new Date('2026-03-25T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-report-income-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 3_000_000,
          creditAmount: 0,
          description: 'March salary'
        },
        {
          id: 'jel-report-income-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-4100',
          fundingAccountId: null,
          debitAmount: 0,
          creditAmount: 3_000_000,
          description: 'March salary'
        }
      ]
    },
    {
      id: 'je-report-expense-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-open-1',
      entryNumber: '202603-0002',
      entryDate: new Date('2026-03-20T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-2',
      reversesJournalEntryId: null,
      correctsJournalEntryId: null,
      correctionReason: null,
      status: 'POSTED',
      memo: 'Fuel refill',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-20T01:00:00.000Z'),
      updatedAt: new Date('2026-03-20T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-report-expense-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 84_000,
          creditAmount: 0,
          description: 'Fuel refill'
        },
        {
          id: 'jel-report-expense-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 84_000,
          description: 'Fuel refill'
        }
      ]
    }
  );
  context.state.planItems.push({
    id: 'plan-report-open-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-report-open-1',
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
