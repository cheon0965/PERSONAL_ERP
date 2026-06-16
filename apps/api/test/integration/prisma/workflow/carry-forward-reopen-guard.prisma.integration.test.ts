import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionType } from '@prisma/client';
import {
  cleanupIntegrationWorkspaceFixture,
  createIntegrationWorkspaceFixture,
  createRealApiPrismaIntegrationContext,
  type RealApiPrismaIntegrationContext
} from '../../../support/prisma/context';

test('Real API/DB integration blocks reopening after carry-forward outputs are generated', async (t) => {
  let context: RealApiPrismaIntegrationContext | null = null;
  let fixture: Awaited<
    ReturnType<typeof createIntegrationWorkspaceFixture>
  > | null = null;

  try {
    context = await createRealApiPrismaIntegrationContext(t);
    if (!context) {
      return;
    }
    fixture = await createIntegrationWorkspaceFixture(context.prisma, {
      prefix: 'prisma-carryforward-reopen',
      fundingAccountName: 'Prisma CarryForward Account',
      expenseCategoryName: 'Prisma CarryForward Expense'
    });
    const { accessToken } = await context.login(
      fixture.email,
      fixture.password
    );
    const authHeaders = {
      authorization: `Bearer ${accessToken}`
    };

    const openResponse = await context.request('/accounting-periods', {
      method: 'POST',
      headers: authHeaders,
      body: {
        month: '2026-06',
        initializeOpeningBalance: true,
        openingBalanceLines: [
          {
            accountSubjectId: fixture.assetAccountSubjectId,
            fundingAccountId: fixture.fundingAccountId,
            balanceAmount: 1_500_000
          },
          {
            accountSubjectId: fixture.equityAccountSubjectId,
            balanceAmount: 1_500_000
          }
        ],
        note: 'Prisma carry-forward reopen opening'
      }
    });
    const openedPeriod = openResponse.body as {
      id: string;
      status: string;
      monthLabel: string;
    };

    assert.equal(openResponse.status, 201);
    assert.equal(openedPeriod.status, 'OPEN');
    assert.equal(openedPeriod.monthLabel, '2026-06');

    const collectedResponse = await context.request('/collected-transactions', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'Carry-forward lock target expense',
        type: TransactionType.EXPENSE,
        amountWon: 120_000,
        businessDate: '2026-06-15',
        fundingAccountId: fixture.fundingAccountId,
        categoryId: fixture.expenseCategoryId,
        memo: 'Carry-forward reopen block target'
      }
    });
    const collected = collectedResponse.body as {
      id: string;
      postingStatus: string;
    };

    assert.equal(collectedResponse.status, 201);
    assert.equal(collected.postingStatus, 'READY_TO_POST');

    const confirmResponse = await context.request(
      `/collected-transactions/${collected.id}/confirm`,
      {
        method: 'POST',
        headers: authHeaders
      }
    );
    const confirmedEntry = confirmResponse.body as {
      id: string;
      entryNumber: string;
      status: string;
    };

    assert.equal(confirmResponse.status, 201);
    assert.equal(confirmedEntry.entryNumber, '202606-0001');
    assert.equal(confirmedEntry.status, 'POSTED');

    const closeResponse = await context.request(
      `/accounting-periods/${openedPeriod.id}/close`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          note: 'Prisma carry-forward reopen close'
        }
      }
    );

    assert.equal(closeResponse.status, 201);

    const financialStatementsResponse = await context.request(
      '/financial-statements/generate',
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          periodId: openedPeriod.id
        }
      }
    );

    assert.equal(financialStatementsResponse.status, 201);

    const carryForwardResponse = await context.request(
      '/carry-forwards/generate',
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          fromPeriodId: openedPeriod.id
        }
      }
    );
    const carryForward = carryForwardResponse.body as {
      carryForwardRecord: {
        id: string;
        fromPeriodId: string;
        toPeriodId: string;
      };
      sourcePeriod: {
        id: string;
      };
      targetPeriod: {
        id: string;
        monthLabel: string;
        status: string;
      };
      targetOpeningBalanceSnapshot: {
        sourceKind: string;
        lines: Array<{
          accountSubjectCode: string;
        }>;
      };
    };

    assert.equal(carryForwardResponse.status, 201);
    assert.equal(carryForward.sourcePeriod.id, openedPeriod.id);
    assert.equal(carryForward.targetPeriod.monthLabel, '2026-07');
    assert.equal(carryForward.targetPeriod.status, 'OPEN');
    assert.equal(
      carryForward.targetOpeningBalanceSnapshot.sourceKind,
      'CARRY_FORWARD'
    );
    assert.deepEqual(
      carryForward.targetOpeningBalanceSnapshot.lines.map(
        (line) => line.accountSubjectCode
      ),
      ['1010', '3100']
    );

    const carryForwardViewResponse = await context.request(
      `/carry-forwards?fromPeriodId=${openedPeriod.id}`,
      {
        headers: authHeaders
      }
    );
    const carryForwardView = carryForwardViewResponse.body as {
      carryForwardRecord: {
        id: string;
        fromPeriodId: string;
        toPeriodId: string;
      };
      sourcePeriod: {
        id: string;
        monthLabel: string;
      };
      targetPeriod: {
        id: string;
        monthLabel: string;
        status: string;
      };
      targetOpeningBalanceSnapshot: {
        sourceKind: string;
        lines: Array<{
          accountSubjectCode: string;
        }>;
      };
    };

    assert.equal(carryForwardViewResponse.status, 200);
    assert.equal(
      carryForwardView.carryForwardRecord.id,
      carryForward.carryForwardRecord.id
    );
    assert.equal(carryForwardView.sourcePeriod.id, openedPeriod.id);
    assert.equal(carryForwardView.sourcePeriod.monthLabel, '2026-06');
    assert.equal(
      carryForwardView.targetPeriod.id,
      carryForward.targetPeriod.id
    );
    assert.equal(carryForwardView.targetPeriod.monthLabel, '2026-07');
    assert.equal(carryForwardView.targetPeriod.status, 'OPEN');
    assert.equal(
      carryForwardView.targetOpeningBalanceSnapshot.sourceKind,
      'CARRY_FORWARD'
    );
    assert.deepEqual(
      carryForwardView.targetOpeningBalanceSnapshot.lines.map(
        (line) => line.accountSubjectCode
      ),
      ['1010', '3100']
    );

    const targetPeriodFinancialViewResponse = await context.request(
      `/financial-statements?periodId=${carryForward.targetPeriod.id}`,
      {
        headers: authHeaders
      }
    );
    const targetPeriodFinancialView =
      targetPeriodFinancialViewResponse.body as {
        period: {
          id: string;
          status: string;
        };
        basis: {
          openingBalanceSourceKind: string | null;
          carryForwardRecordId: string | null;
          sourcePeriodId: string | null;
          sourceMonthLabel: string | null;
        };
        snapshots: Array<unknown>;
        warnings: string[];
      };

    assert.equal(targetPeriodFinancialViewResponse.status, 200);
    assert.equal(
      targetPeriodFinancialView.period.id,
      carryForward.targetPeriod.id
    );
    assert.equal(targetPeriodFinancialView.period.status, 'OPEN');
    assert.equal(
      targetPeriodFinancialView.basis.openingBalanceSourceKind,
      'CARRY_FORWARD'
    );
    assert.equal(
      targetPeriodFinancialView.basis.carryForwardRecordId,
      carryForward.carryForwardRecord.id
    );
    assert.equal(
      targetPeriodFinancialView.basis.sourcePeriodId,
      openedPeriod.id
    );
    assert.equal(targetPeriodFinancialView.basis.sourceMonthLabel, '2026-06');
    assert.equal(targetPeriodFinancialView.snapshots.length, 0);
    assert.ok(
      targetPeriodFinancialView.warnings.some((warning) =>
        warning.includes('잠금되지 않아')
      )
    );
    assert.ok(
      targetPeriodFinancialView.warnings.some((warning) =>
        warning.includes('공식 재무제표 스냅샷이 아직 생성되지 않았습니다.')
      )
    );

    const reopenBlockedResponse = await context.request(
      `/accounting-periods/${openedPeriod.id}/reopen`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          reason: 'Attempt reopen after carry-forward generation.'
        }
      }
    );

    assert.equal(reopenBlockedResponse.status, 409);
    assert.deepEqual(reopenBlockedResponse.body, {
      statusCode: 409,
      message: '차기 이월이 이미 생성된 운영 기간은 재오픈할 수 없습니다.',
      error: 'Conflict'
    });

    const persistedSourcePeriod =
      await context.prisma.accountingPeriod.findUnique({
        where: {
          id: openedPeriod.id
        },
        select: {
          status: true,
          lockedAt: true
        }
      });
    const persistedTargetPeriod =
      await context.prisma.accountingPeriod.findUnique({
        where: {
          id: carryForward.targetPeriod.id
        },
        select: {
          status: true
        }
      });

    assert.equal(persistedSourcePeriod?.status, 'LOCKED');
    assert.ok(persistedSourcePeriod?.lockedAt);
    assert.equal(persistedTargetPeriod?.status, 'OPEN');
    assert.equal(
      await context.prisma.carryForwardRecord.count({
        where: {
          fromPeriodId: openedPeriod.id
        }
      }),
      1
    );
    assert.equal(
      await context.prisma.openingBalanceSnapshot.count({
        where: {
          effectivePeriodId: carryForward.targetPeriod.id
        }
      }),
      1
    );
    assert.equal(
      await context.prisma.financialStatementSnapshot.count({
        where: {
          periodId: openedPeriod.id
        }
      }),
      4
    );
  } finally {
    if (context && fixture) {
      await cleanupIntegrationWorkspaceFixture(context.prisma, fixture);
    }
    if (context) {
      await context.close();
    }
  }
});
