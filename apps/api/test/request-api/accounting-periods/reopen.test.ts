import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinancialStatementPayload } from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  FinancialStatementKind,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';

test('POST /accounting-periods/:id/reopen reopens the latest locked period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-reopen-1',
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
    context.state.periodStatusHistory.push(
      {
        id: 'period-history-reopen-open-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-1',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '3월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'period-history-reopen-lock-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-1',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        eventType: 'LOCK',
        reason: '3월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-31T15:00:00.000Z')
      }
    );
    context.state.closingSnapshots.push({
      id: 'closing-reopen-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-reopen-1',
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      totalAssetAmount: 140_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 140_000,
      periodPnLAmount: 140_000,
      createdAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push({
      id: 'closing-reopen-line-1',
      snapshotKind: 'CLOSING',
      openingSnapshotId: null,
      closingSnapshotId: 'closing-reopen-1',
      accountSubjectId: 'as-1-1010',
      fundingAccountId: 'acc-1',
      balanceAmount: 140_000
    });
    context.state.financialStatementSnapshots.push(
      {
        id: 'financial-reopen-bs',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-1',
        statementKind: FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
        currency: 'KRW',
        payload: {
          summary: [{ label: '자산 총계', amountWon: 140_000 }],
          sections: [],
          notes: []
        } as FinancialStatementPayload,
        createdAt: new Date('2026-03-31T15:10:00.000Z'),
        updatedAt: new Date('2026-03-31T15:10:00.000Z')
      },
      {
        id: 'financial-reopen-pl',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-1',
        statementKind: FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
        currency: 'KRW',
        payload: {
          summary: [{ label: '당기 손익', amountWon: 140_000 }],
          sections: [],
          notes: []
        } as FinancialStatementPayload,
        createdAt: new Date('2026-03-31T15:10:00.000Z'),
        updatedAt: new Date('2026-03-31T15:10:00.000Z')
      }
    );

    const response = await context.request(
      '/accounting-periods/period-reopen-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '재무제표 재산출 필요'
        }
      }
    );

    const body = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(body.status, AccountingPeriodStatus.OPEN);
    assert.equal(body.lockedAt, null);
    assert.equal(context.state.closingSnapshots.length, 0);
    assert.equal(context.state.balanceSnapshotLines.length, 0);
    assert.equal(context.state.financialStatementSnapshots.length, 0);
    assert.equal(
      context.state.accountingPeriods.find(
        (item) => item.id === 'period-reopen-1'
      )?.status,
      AccountingPeriodStatus.OPEN
    );
    assert.equal(
      context.state.accountingPeriods.find(
        (item) => item.id === 'period-reopen-1'
      )?.lockedAt,
      null
    );
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.toStatus,
      AccountingPeriodStatus.OPEN
    );
    assert.equal(context.state.periodStatusHistory.at(-1)?.eventType, 'REOPEN');
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.reason,
      '재무제표 재산출 필요'
    );
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.actorMembershipId,
      'membership-1'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'accounting_period.reopen' &&
          candidate.details.periodId === 'period-reopen-1' &&
          candidate.details.reason === '재무제표 재산출 필요'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen rolls back an unused latest successor month before reopening', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-reopen-older-1',
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
        id: 'period-reopen-older-next',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 4,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-04-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      }
    );
    context.state.periodStatusHistory.push({
      id: 'period-history-reopen-older-next-open',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-reopen-older-next',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '4월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-01T00:00:00.000Z')
    });

    const response = await context.request(
      '/accounting-periods/period-reopen-older-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '과거 월 재오픈 시도'
        }
      }
    );

    const body = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(body.status, AccountingPeriodStatus.OPEN);
    assert.equal(body.lockedAt, null);
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-reopen-older-1'
      )?.status,
      AccountingPeriodStatus.OPEN
    );
    assert.equal(
      context.state.accountingPeriods.some(
        (candidate) => candidate.id === 'period-reopen-older-next'
      ),
      false
    );
    assert.equal(
      context.state.periodStatusHistory.some(
        (candidate) => candidate.periodId === 'period-reopen-older-next'
      ),
      false
    );
    assert.equal(context.state.periodStatusHistory.at(-1)?.eventType, 'REOPEN');
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen blocks successor rollback when the latest month has usage', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-reopen-used-1',
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
        id: 'period-reopen-used-next',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 4,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-04-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      }
    );
    context.state.collectedTransactions.push({
      id: 'collected-reopen-used-next',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-reopen-used-next',
      ledgerTransactionTypeId: 'ltt-expense-basic',
      fundingAccountId: 'acc-1',
      categoryId: null,
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: null,
      title: '4월 운영 거래',
      occurredOn: new Date('2026-04-03T00:00:00.000Z'),
      amount: 50_000,
      status: CollectedTransactionStatus.COLLECTED,
      memo: null,
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      updatedAt: new Date('2026-04-03T00:00:00.000Z')
    });

    const response = await context.request(
      '/accounting-periods/period-reopen-used-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '최신 월 사용 이력 있는 상태에서 재오픈 시도'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message:
        '최근 운영 월 2026-04에 수집 거래 1건이 있어 2026-03은 재오픈할 수 없습니다. 최신 월 데이터를 먼저 정리한 뒤 다시 시도해 주세요.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-reopen-used-1'
      )?.status,
      AccountingPeriodStatus.LOCKED
    );
    assert.equal(
      context.state.accountingPeriods.some(
        (candidate) => candidate.id === 'period-reopen-used-next'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen blocks reopening when carry-forward outputs already exist', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-reopen-blocked-1',
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
        id: 'period-reopen-blocked-next',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 4,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-04-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      }
    );
    context.state.periodStatusHistory.push(
      {
        id: 'period-history-reopen-blocked-open-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-blocked-1',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '3월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'period-history-reopen-blocked-lock-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-blocked-1',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        eventType: 'LOCK',
        reason: '3월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-31T15:00:00.000Z')
      }
    );
    context.state.closingSnapshots.push({
      id: 'closing-reopen-blocked-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-reopen-blocked-1',
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      totalAssetAmount: 140_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 140_000,
      periodPnLAmount: 140_000,
      createdAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.financialStatementSnapshots.push({
      id: 'financial-reopen-blocked-bs',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-reopen-blocked-1',
      statementKind: FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
      currency: 'KRW',
      payload: {
        summary: [{ label: '자산 총계', amountWon: 140_000 }],
        sections: [],
        notes: []
      } as FinancialStatementPayload,
      createdAt: new Date('2026-03-31T15:10:00.000Z'),
      updatedAt: new Date('2026-03-31T15:10:00.000Z')
    });
    context.state.openingBalanceSnapshots.push({
      id: 'opening-reopen-blocked-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-reopen-blocked-next',
      sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.carryForwardRecords.push({
      id: 'carry-forward-reopen-blocked-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      fromPeriodId: 'period-reopen-blocked-1',
      toPeriodId: 'period-reopen-blocked-next',
      sourceClosingSnapshotId: 'closing-reopen-blocked-1',
      createdJournalEntryId: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });

    const response = await context.request(
      '/accounting-periods/period-reopen-blocked-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '차기 이월 이후 재오픈 시도'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message: '차기 이월이 이미 생성된 운영 기간은 재오픈할 수 없습니다.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-reopen-blocked-1'
      )?.status,
      AccountingPeriodStatus.LOCKED
    );
    assert.equal(context.state.closingSnapshots.length, 1);
    assert.equal(context.state.financialStatementSnapshots.length, 1);
    assert.equal(context.state.carryForwardRecords.length, 1);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen returns 400 when the reopen reason is blank after trimming', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-reopen-blank-1',
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

    const initialHistoryCount = context.state.periodStatusHistory.length;
    const response = await context.request(
      '/accounting-periods/period-reopen-blank-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '   '
        }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message: '재오픈 사유를 입력해 주세요.',
      error: 'Bad Request'
    });
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-reopen-blank-1'
      )?.status,
      AccountingPeriodStatus.LOCKED
    );
    assert.equal(context.state.periodStatusHistory.length, initialHistoryCount);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen returns 403 when the current membership role cannot reopen', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'MANAGER';
    context.state.accountingPeriods.push({
      id: 'period-reopen-denied-1',
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

    const response = await context.request(
      '/accounting-periods/period-reopen-denied-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '재오픈 사유 확인 필요'
        }
      }
    );

    assert.equal(response.status, 403);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'accounting_period.reopen' &&
          candidate.details.periodId === 'period-reopen-denied-1' &&
          candidate.details.membershipRole === 'MANAGER'
      )
    );
  } finally {
    await context.close();
  }
});
