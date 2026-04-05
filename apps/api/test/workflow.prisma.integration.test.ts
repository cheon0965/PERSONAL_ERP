import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ImportSourceKind,
  RecurrenceFrequency,
  TransactionType
} from '@prisma/client';
import {
  cleanupIntegrationWorkspaceFixture,
  createIntegrationWorkspaceFixture,
  createRealApiPrismaIntegrationContext,
  type RealApiPrismaIntegrationContext
} from './prisma-integration.test-support';

test('Real API/DB integration covers accounting period open -> import batch -> collect -> confirm -> close', async (t) => {
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
      prefix: 'prisma-period-flow',
      fundingAccountName: 'Prisma Flow Main Account',
      expenseCategoryName: 'Prisma Flow Expense'
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
        month: '2026-03',
        initializeOpeningBalance: true,
        openingBalanceLines: [
          {
            accountSubjectId: fixture.assetAccountSubjectId,
            fundingAccountId: fixture.fundingAccountId,
            balanceAmount: 1_000_000
          },
          {
            accountSubjectId: fixture.equityAccountSubjectId,
            balanceAmount: 1_000_000
          }
        ],
        note: 'Prisma integration opening'
      }
    });
    const openedPeriod = openResponse.body as {
      id: string;
      status: string;
      hasOpeningBalanceSnapshot: boolean;
    };

    assert.equal(openResponse.status, 201);
    assert.equal(openedPeriod.status, 'OPEN');
    assert.equal(openedPeriod.hasOpeningBalanceSnapshot, true);

    const uploadResponse = await context.request('/import-batches', {
      method: 'POST',
      headers: authHeaders,
      body: {
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        fileName: 'prisma-flow-manual.csv',
        content: ['date,title,amount', '2026-03-12,Fuel refill,84000'].join(
          '\n'
        )
      }
    });
    const uploadedBatch = uploadResponse.body as {
      id: string;
      parseStatus: string;
      rows: Array<{
        id: string;
        parseStatus: string;
      }>;
    };

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadedBatch.parseStatus, 'COMPLETED');
    assert.equal(uploadedBatch.rows.length, 1);
    assert.equal(uploadedBatch.rows[0]?.parseStatus, 'PARSED');

    const collectResponse = await context.request(
      `/import-batches/${uploadedBatch.id}/rows/${uploadedBatch.rows[0]?.id}/collect`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: fixture.fundingAccountId,
          categoryId: fixture.expenseCategoryId,
          memo: 'Imported by Prisma integration test'
        }
      }
    );
    const collected = collectResponse.body as {
      collectedTransaction: {
        id: string;
        title: string;
        postingStatus: string;
        categoryName: string | null;
      };
      preview: {
        autoPreparation: {
          matchedPlanItemId: string | null;
          effectiveCategoryName: string | null;
        };
      };
    };

    assert.equal(collectResponse.status, 201);
    assert.equal(collected.collectedTransaction.title, 'Fuel refill');
    assert.equal(collected.collectedTransaction.postingStatus, 'READY_TO_POST');
    assert.equal(
      collected.collectedTransaction.categoryName,
      fixture.expenseCategoryName
    );
    assert.equal(collected.preview.autoPreparation.matchedPlanItemId, null);
    assert.equal(
      collected.preview.autoPreparation.effectiveCategoryName,
      fixture.expenseCategoryName
    );

    const confirmResponse = await context.request(
      `/collected-transactions/${collected.collectedTransaction.id}/confirm`,
      {
        method: 'POST',
        headers: authHeaders
      }
    );
    const confirmedJournalEntry = confirmResponse.body as {
      id: string;
      entryNumber: string;
      status: string;
      sourceCollectedTransactionId: string | null;
    };

    assert.equal(confirmResponse.status, 201);
    assert.equal(confirmedJournalEntry.status, 'POSTED');
    assert.equal(
      confirmedJournalEntry.sourceCollectedTransactionId,
      collected.collectedTransaction.id
    );
    assert.match(confirmedJournalEntry.entryNumber, /^202603-\d{4}$/);

    const closeResponse = await context.request(
      `/accounting-periods/${openedPeriod.id}/close`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          note: 'Prisma integration close'
        }
      }
    );
    const closedPeriod = closeResponse.body as {
      period: {
        id: string;
        status: string;
      };
      closingSnapshot: {
        totalAssetAmount: number;
        totalLiabilityAmount: number;
        totalEquityAmount: number;
        periodPnLAmount: number;
        lines: Array<{
          accountSubjectCode: string;
        }>;
      };
    };

    assert.equal(closeResponse.status, 201);
    assert.equal(closedPeriod.period.id, openedPeriod.id);
    assert.equal(closedPeriod.period.status, 'LOCKED');
    assert.equal(closedPeriod.closingSnapshot.totalAssetAmount, 916_000);
    assert.equal(closedPeriod.closingSnapshot.totalLiabilityAmount, 0);
    assert.equal(closedPeriod.closingSnapshot.totalEquityAmount, 916_000);
    assert.equal(closedPeriod.closingSnapshot.periodPnLAmount, -84_000);
    assert.deepEqual(
      closedPeriod.closingSnapshot.lines
        .map((line) => line.accountSubjectCode)
        .sort(),
      ['1010', '3100', '5100']
    );

    const journalEntryCount = await context.prisma.journalEntry.count({
      where: {
        tenantId: fixture.tenantId
      }
    });
    const lockedPeriod = await context.prisma.accountingPeriod.findUnique({
      where: {
        id: openedPeriod.id
      },
      select: {
        status: true
      }
    });

    assert.equal(journalEntryCount, 1);
    assert.equal(lockedPeriod?.status, 'LOCKED');
  } finally {
    if (context && fixture) {
      await cleanupIntegrationWorkspaceFixture(context.prisma, fixture);
    }
    if (context) {
      await context.close();
    }
  }
});

test('Real API/DB integration covers recurring rule -> plan items -> auto-matched import collect -> confirm -> financial statements', async (t) => {
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
      prefix: 'prisma-planning-flow',
      fundingAccountName: 'Prisma Planning Account',
      expenseCategoryName: 'Prisma Utilities'
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
        month: '2026-04',
        initializeOpeningBalance: true,
        openingBalanceLines: [
          {
            accountSubjectId: fixture.assetAccountSubjectId,
            fundingAccountId: fixture.fundingAccountId,
            balanceAmount: 1_200_000
          },
          {
            accountSubjectId: fixture.equityAccountSubjectId,
            balanceAmount: 1_200_000
          }
        ],
        note: 'Prisma planning opening'
      }
    });
    const openedPeriod = openResponse.body as {
      id: string;
    };

    assert.equal(openResponse.status, 201);

    const recurringRuleResponse = await context.request('/recurring-rules', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'Phone bill',
        fundingAccountId: fixture.fundingAccountId,
        categoryId: fixture.expenseCategoryId,
        amountWon: 75_000,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 10,
        startDate: '2026-04-10',
        isActive: true
      }
    });
    const recurringRule = recurringRuleResponse.body as {
      id: string;
    };

    assert.equal(recurringRuleResponse.status, 201);
    assert.ok(recurringRule.id);

    const generatePlanItemsResponse = await context.request(
      '/plan-items/generate',
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          periodId: openedPeriod.id
        }
      }
    );
    const generatedPlanItems = generatePlanItemsResponse.body as {
      generation: {
        createdCount: number;
        skippedExistingCount: number;
        excludedRuleCount: number;
      };
      items: Array<{
        id: string;
        status: string;
        title: string;
      }>;
    };

    assert.equal(generatePlanItemsResponse.status, 201);
    assert.equal(generatedPlanItems.generation.createdCount, 1);
    assert.equal(generatedPlanItems.generation.skippedExistingCount, 0);
    assert.equal(generatedPlanItems.generation.excludedRuleCount, 0);
    assert.equal(generatedPlanItems.items.length, 1);
    assert.equal(generatedPlanItems.items[0]?.status, 'DRAFT');
    assert.equal(generatedPlanItems.items[0]?.title, 'Phone bill');

    const uploadResponse = await context.request('/import-batches', {
      method: 'POST',
      headers: authHeaders,
      body: {
        sourceKind: ImportSourceKind.MANUAL_UPLOAD,
        fileName: 'prisma-recurring-flow.csv',
        content: ['date,title,amount', '2026-04-12,Phone bill,75000'].join('\n')
      }
    });
    const uploadedBatch = uploadResponse.body as {
      id: string;
      rows: Array<{
        id: string;
      }>;
    };

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadedBatch.rows.length, 1);

    const collectResponse = await context.request(
      `/import-batches/${uploadedBatch.id}/rows/${uploadedBatch.rows[0]?.id}/collect`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          type: TransactionType.EXPENSE,
          fundingAccountId: fixture.fundingAccountId,
          memo: 'Imported recurring bill'
        }
      }
    );
    const collected = collectResponse.body as {
      collectedTransaction: {
        id: string;
        matchedPlanItemId: string | null;
        matchedPlanItemTitle: string | null;
        postingStatus: string;
      };
      preview: {
        autoPreparation: {
          matchedPlanItemId: string | null;
          matchedPlanItemTitle: string | null;
          effectiveCategoryName: string | null;
          nextWorkflowStatus: string;
        };
      };
    };

    assert.equal(collectResponse.status, 201);
    assert.equal(
      collected.preview.autoPreparation.matchedPlanItemId,
      generatedPlanItems.items[0]?.id ?? null
    );
    assert.equal(
      collected.preview.autoPreparation.matchedPlanItemTitle,
      'Phone bill'
    );
    assert.equal(
      collected.preview.autoPreparation.effectiveCategoryName,
      fixture.expenseCategoryName
    );
    assert.equal(
      collected.preview.autoPreparation.nextWorkflowStatus,
      'READY_TO_POST'
    );
    assert.equal(
      collected.collectedTransaction.matchedPlanItemId,
      generatedPlanItems.items[0]?.id ?? null
    );
    assert.equal(
      collected.collectedTransaction.matchedPlanItemTitle,
      'Phone bill'
    );
    assert.equal(collected.collectedTransaction.postingStatus, 'READY_TO_POST');

    const planItemsAfterCollectResponse = await context.request(
      `/plan-items?periodId=${openedPeriod.id}`,
      {
        headers: authHeaders
      }
    );
    const planItemsAfterCollect = planItemsAfterCollectResponse.body as {
      summary: {
        matchedCount: number;
      };
      items: Array<{
        id: string;
        status: string;
        matchedCollectedTransactionId: string | null;
      }>;
    };

    assert.equal(planItemsAfterCollectResponse.status, 200);
    assert.equal(planItemsAfterCollect.summary.matchedCount, 1);
    assert.equal(planItemsAfterCollect.items[0]?.status, 'MATCHED');
    assert.equal(
      planItemsAfterCollect.items[0]?.matchedCollectedTransactionId,
      collected.collectedTransaction.id
    );

    const confirmResponse = await context.request(
      `/collected-transactions/${collected.collectedTransaction.id}/confirm`,
      {
        method: 'POST',
        headers: authHeaders
      }
    );
    const confirmedJournalEntry = confirmResponse.body as {
      id: string;
      status: string;
    };

    assert.equal(confirmResponse.status, 201);
    assert.equal(confirmedJournalEntry.status, 'POSTED');

    const planItemsAfterConfirmResponse = await context.request(
      `/plan-items?periodId=${openedPeriod.id}`,
      {
        headers: authHeaders
      }
    );
    const planItemsAfterConfirm = planItemsAfterConfirmResponse.body as {
      summary: {
        confirmedCount: number;
      };
      items: Array<{
        id: string;
        status: string;
        matchedCollectedTransactionId: string | null;
        matchedCollectedTransactionStatus: string | null;
        postedJournalEntryId: string | null;
      }>;
    };

    assert.equal(planItemsAfterConfirmResponse.status, 200);
    assert.equal(planItemsAfterConfirm.summary.confirmedCount, 1);
    assert.equal(planItemsAfterConfirm.items[0]?.status, 'CONFIRMED');
    assert.equal(
      planItemsAfterConfirm.items[0]?.matchedCollectedTransactionId,
      collected.collectedTransaction.id
    );
    assert.equal(
      planItemsAfterConfirm.items[0]?.matchedCollectedTransactionStatus,
      'POSTED'
    );
    assert.equal(planItemsAfterConfirm.items[0]?.postedJournalEntryId, null);

    const closeResponse = await context.request(
      `/accounting-periods/${openedPeriod.id}/close`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          note: 'Prisma planning close'
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
    const financialStatements = financialStatementsResponse.body as {
      basis: {
        openingBalanceSourceKind: string | null;
      };
      snapshots: Array<{
        statementKind: string;
        payload: {
          summary: Array<{
            label: string;
            amountWon: number;
          }>;
        };
      }>;
    };
    const positionStatement = financialStatements.snapshots.find(
      (snapshot) => snapshot.statementKind === 'STATEMENT_OF_FINANCIAL_POSITION'
    );
    const profitAndLossStatement = financialStatements.snapshots.find(
      (snapshot) => snapshot.statementKind === 'MONTHLY_PROFIT_AND_LOSS'
    );

    assert.equal(financialStatementsResponse.status, 201);
    assert.equal(
      financialStatements.basis.openingBalanceSourceKind,
      'INITIAL_SETUP'
    );
    assert.equal(financialStatements.snapshots.length, 4);
    assert.equal(positionStatement?.payload.summary[0]?.amountWon, 1_125_000);
    assert.equal(
      profitAndLossStatement?.payload.summary[2]?.amountWon,
      -75_000
    );

    const storedFinancialSnapshotCount =
      await context.prisma.financialStatementSnapshot.count({
        where: {
          periodId: openedPeriod.id
        }
      });

    assert.equal(storedFinancialSnapshotCount, 4);
    assert.ok(confirmedJournalEntry.id);
  } finally {
    if (context && fixture) {
      await cleanupIntegrationWorkspaceFixture(context.prisma, fixture);
    }
    if (context) {
      await context.close();
    }
  }
});
