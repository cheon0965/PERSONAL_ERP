import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CarryForwardView,
  FinancialStatementsView
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  FinancialStatementKind,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
test('POST /financial-statements/generate creates official statement snapshots for a locked period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-report-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-report-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-report-lock-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-1',
      fromStatus: AccountingPeriodStatus.OPEN,
      toStatus: AccountingPeriodStatus.LOCKED,
      eventType: 'LOCK',
      reason: '3월 마감',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.closingSnapshots.push({
      id: 'closing-report-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-1',
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      totalAssetAmount: 2_916_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 2_916_000,
      periodPnLAmount: -84_000,
      createdAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'balance-report-1',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-report-1',
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 2_916_000
      },
      {
        id: 'balance-report-2',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-report-1',
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_000_000
      },
      {
        id: 'balance-report-3',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-report-1',
        accountSubjectId: 'as-1-5100',
        fundingAccountId: null,
        balanceAmount: 84_000
      }
    );
    context.state.journalEntries.push({
      id: 'je-report-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-report-1',
      entryNumber: '202603-0009',
      entryDate: new Date('2026-03-20T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-2',
      status: 'POSTED',
      memo: 'Fuel refill',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-20T01:00:00.000Z'),
      updatedAt: new Date('2026-03-20T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-report-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 84_000,
          creditAmount: 0,
          description: 'Fuel refill'
        },
        {
          id: 'jel-report-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 84_000,
          description: 'Fuel refill'
        }
      ]
    });

    const response = await context.request('/financial-statements/generate', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        periodId: 'period-report-1'
      }
    });

    const body = response.body as FinancialStatementsView;
    const statementKinds = body.snapshots.map(
      (snapshot) => snapshot.statementKind
    );
    const positionStatement = body.snapshots.find(
      (snapshot) => snapshot.statementKind === 'STATEMENT_OF_FINANCIAL_POSITION'
    );
    const cashFlowStatement = body.snapshots.find(
      (snapshot) => snapshot.statementKind === 'CASH_FLOW_SUMMARY'
    );

    assert.equal(response.status, 201);
    assert.equal(body.period.id, 'period-report-1');
    assert.equal(body.previousPeriod, null);
    assert.equal(body.basis.openingBalanceSourceKind, null);
    assert.equal(body.snapshots.length, 4);
    assert.equal(body.comparison.length, 4);
    assert.equal(
      body.warnings.includes(
        '직전 잠금 기간이 없어 전기 대비 비교는 비어 있습니다.'
      ),
      true
    );
    assert.equal(context.state.financialStatementSnapshots.length, 4);
    assert.deepEqual(statementKinds, [
      'STATEMENT_OF_FINANCIAL_POSITION',
      'MONTHLY_PROFIT_AND_LOSS',
      'CASH_FLOW_SUMMARY',
      'NET_WORTH_MOVEMENT'
    ]);
    assert.equal(positionStatement?.payload.summary[0]?.amountWon, 2_916_000);
    assert.equal(cashFlowStatement?.payload.summary[2]?.amountWon, -84_000);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'financial_statement.generate' &&
          candidate.details.periodId === 'period-report-1' &&
          candidate.details.snapshotCount === 4
      )
    );
  } finally {
    await context.close();
  }
});

test('GET /financial-statements returns stored official statement snapshots for the selected locked period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-report-view-prev',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 3,
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.LOCKED,
        openedAt: new Date('2026-03-01T00:00:00.000Z'),
        lockedAt: new Date('2026-03-31T15:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T15:00:00.000Z')
      },
      {
        id: 'period-report-view-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 4,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.LOCKED,
        openedAt: new Date('2026-04-01T00:00:00.000Z'),
        lockedAt: new Date('2026-04-30T15:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-30T15:00:00.000Z')
      }
    );
    context.state.periodStatusHistory.push(
      {
        id: 'period-history-report-view-prev-open',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-prev',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '3월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'period-history-report-view-prev-lock',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-prev',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        eventType: 'LOCK',
        reason: '3월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-31T15:00:00.000Z')
      },
      {
        id: 'period-history-report-view-open-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '4월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-04-01T00:00:00.000Z')
      },
      {
        id: 'period-history-report-view-lock-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        eventType: 'LOCK',
        reason: '4월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-04-30T15:00:00.000Z')
      }
    );
    context.state.openingBalanceSnapshots.push({
      id: 'opening-report-view-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-report-view-1',
      sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.carryForwardRecords.push({
      id: 'carry-forward-report-view-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      fromPeriodId: 'period-report-view-prev',
      toPeriodId: 'period-report-view-1',
      sourceClosingSnapshotId: 'closing-report-view-prev',
      createdJournalEntryId: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.financialStatementSnapshots.push(
      {
        id: 'financial-view-prev-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-prev',
        statementKind: FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
        currency: 'KRW',
        payload: {
          summary: [{ label: '자산 합계', amountWon: 2_880_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-03-31T15:10:00.000Z'),
        updatedAt: new Date('2026-03-31T15:10:00.000Z')
      },
      {
        id: 'financial-view-prev-2',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-prev',
        statementKind: FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
        currency: 'KRW',
        payload: {
          summary: [{ label: '당기 손익', amountWon: 90_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-03-31T15:10:00.000Z'),
        updatedAt: new Date('2026-03-31T15:10:00.000Z')
      },
      {
        id: 'financial-view-prev-3',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-prev',
        statementKind: FinancialStatementKind.CASH_FLOW_SUMMARY,
        currency: 'KRW',
        payload: {
          summary: [{ label: '순현금흐름', amountWon: 90_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-03-31T15:10:00.000Z'),
        updatedAt: new Date('2026-03-31T15:10:00.000Z')
      },
      {
        id: 'financial-view-prev-4',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-prev',
        statementKind: FinancialStatementKind.NET_WORTH_MOVEMENT,
        currency: 'KRW',
        payload: {
          summary: [{ label: '기말 순자산', amountWon: 2_970_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-03-31T15:10:00.000Z'),
        updatedAt: new Date('2026-03-31T15:10:00.000Z')
      },
      {
        id: 'financial-view-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        statementKind: FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
        currency: 'KRW',
        payload: {
          summary: [{ label: '자산 합계', amountWon: 3_000_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-04-30T15:10:00.000Z'),
        updatedAt: new Date('2026-04-30T15:10:00.000Z')
      },
      {
        id: 'financial-view-2',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        statementKind: FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
        currency: 'KRW',
        payload: {
          summary: [{ label: '당기 손익', amountWon: 120_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-04-30T15:10:00.000Z'),
        updatedAt: new Date('2026-04-30T15:10:00.000Z')
      },
      {
        id: 'financial-view-3',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        statementKind: FinancialStatementKind.CASH_FLOW_SUMMARY,
        currency: 'KRW',
        payload: {
          summary: [{ label: '순현금흐름', amountWon: 120_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-04-30T15:10:00.000Z'),
        updatedAt: new Date('2026-04-30T15:10:00.000Z')
      },
      {
        id: 'financial-view-4',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-report-view-1',
        statementKind: FinancialStatementKind.NET_WORTH_MOVEMENT,
        currency: 'KRW',
        payload: {
          summary: [{ label: '기말 순자산', amountWon: 3_120_000 }],
          sections: [],
          notes: []
        },
        createdAt: new Date('2026-04-30T15:10:00.000Z'),
        updatedAt: new Date('2026-04-30T15:10:00.000Z')
      }
    );

    const response = await context.request(
      '/financial-statements?periodId=period-report-view-1',
      {
        headers: context.authHeaders()
      }
    );

    const body = response.body as FinancialStatementsView;

    assert.equal(response.status, 200);
    assert.equal(body.period.id, 'period-report-view-1');
    assert.equal(body.period.monthLabel, '2026-04');
    assert.equal(body.previousPeriod?.monthLabel, '2026-03');
    assert.equal(body.basis.openingBalanceSourceKind, 'CARRY_FORWARD');
    assert.equal(
      body.basis.carryForwardRecordId,
      'carry-forward-report-view-1'
    );
    assert.equal(body.basis.sourceMonthLabel, '2026-03');
    assert.equal(body.snapshots.length, 4);
    assert.equal(body.comparison.length, 4);
    assert.equal(body.comparison[0]?.metrics[0]?.deltaWon, 120_000);
    assert.equal(
      body.snapshots[0]?.statementKind,
      'STATEMENT_OF_FINANCIAL_POSITION'
    );
    assert.equal(body.snapshots[3]?.statementKind, 'NET_WORTH_MOVEMENT');
    assert.deepEqual(body.warnings, []);
  } finally {
    await context.close();
  }
});

test('POST /carry-forwards/generate creates a carry forward record and the next opening snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-carry-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 4,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-05-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-04-01T00:00:00.000Z'),
      lockedAt: new Date('2026-04-30T15:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-carry-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '4월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-carry-lock-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      fromStatus: AccountingPeriodStatus.OPEN,
      toStatus: AccountingPeriodStatus.LOCKED,
      eventType: 'LOCK',
      reason: '4월 마감',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.closingSnapshots.push({
      id: 'closing-carry-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      lockedAt: new Date('2026-04-30T15:00:00.000Z'),
      totalAssetAmount: 2_916_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 2_916_000,
      periodPnLAmount: -84_000,
      createdAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'carry-balance-1',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-1',
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 2_916_000
      },
      {
        id: 'carry-balance-2',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-1',
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_000_000
      },
      {
        id: 'carry-balance-3',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-1',
        accountSubjectId: 'as-1-5100',
        fundingAccountId: null,
        balanceAmount: 84_000
      }
    );

    const response = await context.request('/carry-forwards/generate', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        fromPeriodId: 'period-carry-1'
      }
    });

    const body = response.body as CarryForwardView;

    assert.equal(response.status, 201);
    assert.equal(context.state.carryForwardRecords.length, 1);
    assert.equal(body.sourcePeriod.id, 'period-carry-1');
    assert.equal(body.targetPeriod.monthLabel, '2026-05');
    assert.equal(body.targetPeriod.status, AccountingPeriodStatus.OPEN);
    assert.equal(body.targetOpeningBalanceSnapshot.sourceKind, 'CARRY_FORWARD');
    assert.equal(body.targetOpeningBalanceSnapshot.lines.length, 2);
    assert.deepEqual(
      body.targetOpeningBalanceSnapshot.lines.map((line) => ({
        accountSubjectCode: line.accountSubjectCode,
        balanceAmount: line.balanceAmount
      })),
      [
        {
          accountSubjectCode: '1010',
          balanceAmount: 2_916_000
        },
        {
          accountSubjectCode: '3100',
          balanceAmount: 3_000_000
        }
      ]
    );
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.actorMembershipId,
      'membership-1'
    );
    assert.equal(
      context.state.openingBalanceSnapshots.at(-1)?.createdByActorType,
      AuditActorType.TENANT_MEMBERSHIP
    );
    assert.equal(
      context.state.openingBalanceSnapshots.at(-1)?.createdByMembershipId,
      'membership-1'
    );
    assert.equal(
      context.state.carryForwardRecords[0]?.createdByActorType,
      AuditActorType.TENANT_MEMBERSHIP
    );
    assert.equal(
      context.state.carryForwardRecords[0]?.createdByMembershipId,
      'membership-1'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'carry_forward.generate' &&
          candidate.details.fromPeriodId === 'period-carry-1' &&
          candidate.details.toPeriodId === body.targetPeriod.id &&
          candidate.details.carryForwardRecordId === body.carryForwardRecord.id
      )
    );
  } finally {
    await context.close();
  }
});

test('GET /carry-forwards returns the stored carry forward view for the selected source period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-carry-view-source',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 5,
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-06-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.LOCKED,
        openedAt: new Date('2026-05-01T00:00:00.000Z'),
        lockedAt: new Date('2026-05-31T15:00:00.000Z'),
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-31T15:00:00.000Z')
      },
      {
        id: 'period-carry-view-target',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 6,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-07-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-06-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z')
      }
    );
    context.state.periodStatusHistory.push(
      {
        id: 'period-history-carry-view-source-open',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-source',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '5월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-05-01T00:00:00.000Z')
      },
      {
        id: 'period-history-carry-view-source-lock',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-source',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        eventType: 'LOCK',
        reason: '5월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-05-31T15:00:00.000Z')
      },
      {
        id: 'period-history-carry-view-target-open',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-target',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '5월 이월 생성',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-06-01T00:00:00.000Z')
      }
    );
    context.state.closingSnapshots.push({
      id: 'closing-carry-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-view-source',
      lockedAt: new Date('2026-05-31T15:00:00.000Z'),
      totalAssetAmount: 3_120_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 3_120_000,
      periodPnLAmount: 120_000,
      createdAt: new Date('2026-05-31T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'carry-view-closing-line',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-view',
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 3_120_000
      },
      {
        id: 'carry-view-closing-equity-line',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-view',
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_120_000
      },
      {
        id: 'carry-view-opening-line',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-carry-view',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 3_120_000
      },
      {
        id: 'carry-view-opening-equity-line',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-carry-view',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_120_000
      }
    );
    context.state.openingBalanceSnapshots.push({
      id: 'opening-carry-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-carry-view-target',
      sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.carryForwardRecords.push({
      id: 'carry-record-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      fromPeriodId: 'period-carry-view-source',
      toPeriodId: 'period-carry-view-target',
      sourceClosingSnapshotId: 'closing-carry-view',
      createdJournalEntryId: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });

    const response = await context.request(
      '/carry-forwards?fromPeriodId=period-carry-view-source',
      {
        headers: context.authHeaders()
      }
    );

    const body = response.body as CarryForwardView;

    assert.equal(response.status, 200);
    assert.equal(body.carryForwardRecord.id, 'carry-record-view');
    assert.equal(body.sourcePeriod.monthLabel, '2026-05');
    assert.equal(body.targetPeriod.monthLabel, '2026-06');
    assert.equal(body.targetOpeningBalanceSnapshot.lines.length, 2);
    assert.deepEqual(
      body.targetOpeningBalanceSnapshot.lines.map(
        (line) => line.accountSubjectCode
      ),
      ['1010', '3100']
    );
  } finally {
    await context.close();
  }
});
