import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

function readEmailVerificationToken(text: string | undefined): string {
  assert.ok(text);
  const match = text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(match?.[1]);
  return match[1];
}

async function cleanupRegisteredIntegrationUser(
  context: RealApiPrismaIntegrationContext,
  email: string
): Promise<void> {
  const membership = await context.prisma.tenantMembership.findFirst({
    where: {
      user: { email }
    },
    select: {
      userId: true,
      tenantId: true,
      tenant: {
        select: {
          defaultLedgerId: true
        }
      }
    }
  });

  if (membership?.tenant.defaultLedgerId) {
    await cleanupIntegrationWorkspaceFixture(context.prisma, {
      userId: membership.userId,
      tenantId: membership.tenantId,
      ledgerId: membership.tenant.defaultLedgerId
    });
    return;
  }

  const user = await context.prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (!user) {
    return;
  }

  await context.prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id }
  });
  await context.prisma.userSetting.deleteMany({
    where: { userId: user.id }
  });
  await context.prisma.user.delete({
    where: { id: user.id }
  });
}

test('Real API/DB integration covers register -> verify-email -> login -> auth/me', async (t) => {
  let context: RealApiPrismaIntegrationContext | null = null;
  const email = `prisma-register-${randomUUID()}@example.com`;
  const password = 'Register1234!';

  try {
    context = await createRealApiPrismaIntegrationContext(t);
    if (!context) {
      return;
    }

    const registerResponse = await context.request('/auth/register', {
      method: 'POST',
      body: {
        email,
        password,
        name: 'Prisma Register Owner',
        termsAccepted: true,
        privacyConsentAccepted: true
      }
    });

    assert.equal(registerResponse.status, 200);
    assert.deepEqual(registerResponse.body, { status: 'verification_sent' });
    assert.equal(context.sentEmails.length, 1);
    assert.equal(context.sentEmails[0]?.to, email);

    const registeredUser = await context.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerifiedAt: true
      }
    });
    assert.ok(registeredUser);
    assert.equal(registeredUser.emailVerifiedAt, null);

    const loginBeforeVerification = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email,
        password
      }
    });

    assert.equal(loginBeforeVerification.status, 401);

    const token = readEmailVerificationToken(context.sentEmails[0]?.text);
    const verifyResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token }
    });

    assert.equal(verifyResponse.status, 200);
    assert.deepEqual(verifyResponse.body, { status: 'verified' });

    const verifiedUser = await context.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerifiedAt: true
      }
    });
    assert.ok(verifiedUser?.emailVerifiedAt);

    const membership = await context.prisma.tenantMembership.findFirst({
      where: { userId: verifiedUser.id },
      select: {
        id: true,
        role: true,
        status: true,
        tenantId: true,
        tenant: {
          select: {
            defaultLedgerId: true
          }
        }
      }
    });
    assert.ok(membership);
    assert.equal(membership.role, 'OWNER');
    assert.equal(membership.status, 'ACTIVE');
    assert.ok(membership.tenant.defaultLedgerId);

    assert.equal(
      await context.prisma.accountSubject.count({
        where: { ledgerId: membership.tenant.defaultLedgerId }
      }),
      5
    );
    assert.equal(
      await context.prisma.ledgerTransactionType.count({
        where: { ledgerId: membership.tenant.defaultLedgerId }
      }),
      7
    );

    const { accessToken } = await context.login(email, password);
    const meResponse = await context.request('/auth/me', {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });
    const me = meResponse.body as {
      email: string;
      currentWorkspace?: {
        membership?: { role: string; status: string };
        ledger?: { id: string };
      };
    };

    assert.equal(meResponse.status, 200);
    assert.equal(me.email, email);
    assert.equal(me.currentWorkspace?.membership?.role, 'OWNER');
    assert.equal(me.currentWorkspace?.membership?.status, 'ACTIVE');
    assert.equal(
      me.currentWorkspace?.ledger?.id,
      membership.tenant.defaultLedgerId
    );
  } finally {
    if (context) {
      await cleanupRegisteredIntegrationUser(context, email);
      await context.close();
    }
  }
});

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
        matchedCollectedTransactionId: string | null;
        matchedCollectedTransactionStatus: string | null;
      }>;
    };

    assert.equal(generatePlanItemsResponse.status, 201);
    assert.equal(generatedPlanItems.generation.createdCount, 1);
    assert.equal(generatedPlanItems.generation.skippedExistingCount, 0);
    assert.equal(generatedPlanItems.generation.excludedRuleCount, 0);
    assert.equal(generatedPlanItems.items.length, 1);
    assert.equal(generatedPlanItems.items[0]?.status, 'MATCHED');
    assert.equal(generatedPlanItems.items[0]?.title, 'Phone bill');
    assert.ok(generatedPlanItems.items[0]?.matchedCollectedTransactionId);
    assert.equal(
      generatedPlanItems.items[0]?.matchedCollectedTransactionStatus,
      'READY_TO_POST'
    );

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
    assert.equal(
      collected.collectedTransaction.id,
      generatedPlanItems.items[0]?.matchedCollectedTransactionId
    );

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

test('Real API/DB integration covers close -> financial statements -> reopen -> reverse/correct adjustments', async (t) => {
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
      prefix: 'prisma-adjustment-flow',
      fundingAccountName: 'Prisma Adjustment Account',
      expenseCategoryName: 'Prisma Adjustment Expense'
    });
    const expenseAccountSubject =
      await context.prisma.accountSubject.findUniqueOrThrow({
        where: {
          ledgerId_code: {
            ledgerId: fixture.ledgerId,
            code: '5100'
          }
        },
        select: {
          id: true
        }
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
        month: '2026-05',
        initializeOpeningBalance: true,
        openingBalanceLines: [
          {
            accountSubjectId: fixture.assetAccountSubjectId,
            fundingAccountId: fixture.fundingAccountId,
            balanceAmount: 2_000_000
          },
          {
            accountSubjectId: fixture.equityAccountSubjectId,
            balanceAmount: 2_000_000
          }
        ],
        note: 'Prisma adjustment opening'
      }
    });
    const openedPeriod = openResponse.body as {
      id: string;
      status: string;
      monthLabel: string;
    };

    assert.equal(openResponse.status, 201);
    assert.equal(openedPeriod.status, 'OPEN');
    assert.equal(openedPeriod.monthLabel, '2026-05');

    const reverseCollectedResponse = await context.request(
      '/collected-transactions',
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          title: 'Reverse target fuel expense',
          type: TransactionType.EXPENSE,
          amountWon: 84_000,
          businessDate: '2026-05-10',
          fundingAccountId: fixture.fundingAccountId,
          categoryId: fixture.expenseCategoryId,
          memo: 'Reverse target'
        }
      }
    );
    const reverseCollected = reverseCollectedResponse.body as {
      id: string;
      postingStatus: string;
    };

    assert.equal(reverseCollectedResponse.status, 201);
    assert.equal(reverseCollected.postingStatus, 'READY_TO_POST');

    const correctCollectedResponse = await context.request(
      '/collected-transactions',
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          title: 'Correct target fuel expense',
          type: TransactionType.EXPENSE,
          amountWon: 95_000,
          businessDate: '2026-05-11',
          fundingAccountId: fixture.fundingAccountId,
          categoryId: fixture.expenseCategoryId,
          memo: 'Correct target'
        }
      }
    );
    const correctCollected = correctCollectedResponse.body as {
      id: string;
      postingStatus: string;
    };

    assert.equal(correctCollectedResponse.status, 201);
    assert.equal(correctCollected.postingStatus, 'READY_TO_POST');

    const reverseConfirmResponse = await context.request(
      `/collected-transactions/${reverseCollected.id}/confirm`,
      {
        method: 'POST',
        headers: authHeaders
      }
    );
    const reverseSourceEntry = reverseConfirmResponse.body as {
      id: string;
      entryNumber: string;
      status: string;
    };

    assert.equal(reverseConfirmResponse.status, 201);
    assert.equal(reverseSourceEntry.entryNumber, '202605-0001');
    assert.equal(reverseSourceEntry.status, 'POSTED');

    const correctConfirmResponse = await context.request(
      `/collected-transactions/${correctCollected.id}/confirm`,
      {
        method: 'POST',
        headers: authHeaders
      }
    );
    const correctSourceEntry = correctConfirmResponse.body as {
      id: string;
      entryNumber: string;
      status: string;
    };

    assert.equal(correctConfirmResponse.status, 201);
    assert.equal(correctSourceEntry.entryNumber, '202605-0002');
    assert.equal(correctSourceEntry.status, 'POSTED');

    const closeResponse = await context.request(
      `/accounting-periods/${openedPeriod.id}/close`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          note: 'Prisma adjustment close'
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
      snapshots: Array<{
        statementKind: string;
      }>;
    };

    assert.equal(financialStatementsResponse.status, 201);
    assert.equal(financialStatements.snapshots.length, 4);

    const reopenResponse = await context.request(
      `/accounting-periods/${openedPeriod.id}/reopen`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          reason:
            'Need to adjust posted journal entries after month-end review.'
        }
      }
    );
    const reopenedPeriod = reopenResponse.body as {
      id: string;
      status: string;
      lockedAt: string | null;
    };

    assert.equal(reopenResponse.status, 201);
    assert.equal(reopenedPeriod.id, openedPeriod.id);
    assert.equal(reopenedPeriod.status, 'OPEN');
    assert.equal(reopenedPeriod.lockedAt, null);
    assert.equal(
      await context.prisma.closingSnapshot.count({
        where: {
          periodId: openedPeriod.id
        }
      }),
      0
    );
    assert.equal(
      await context.prisma.financialStatementSnapshot.count({
        where: {
          periodId: openedPeriod.id
        }
      }),
      0
    );

    const financialStatementsAfterReopenResponse = await context.request(
      `/financial-statements?periodId=${openedPeriod.id}`,
      {
        headers: authHeaders
      }
    );
    const financialStatementsAfterReopen =
      financialStatementsAfterReopenResponse.body as {
        period: {
          status: string;
        };
        basis: {
          openingBalanceSourceKind: string | null;
          carryForwardRecordId: string | null;
        };
        snapshots: Array<unknown>;
        warnings: string[];
      };

    assert.equal(financialStatementsAfterReopenResponse.status, 200);
    assert.equal(financialStatementsAfterReopen.period.status, 'OPEN');
    assert.equal(
      financialStatementsAfterReopen.basis.openingBalanceSourceKind,
      'INITIAL_SETUP'
    );
    assert.equal(
      financialStatementsAfterReopen.basis.carryForwardRecordId,
      null
    );
    assert.equal(financialStatementsAfterReopen.snapshots.length, 0);
    assert.ok(
      financialStatementsAfterReopen.warnings.some((warning) =>
        warning.includes('잠금되지 않아')
      )
    );
    assert.ok(
      financialStatementsAfterReopen.warnings.some((warning) =>
        warning.includes('공식 재무제표 스냅샷이 아직 생성되지 않았습니다.')
      )
    );

    const reverseResponse = await context.request(
      `/journal-entries/${reverseSourceEntry.id}/reverse`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          entryDate: '2026-05-20',
          reason: 'Reverse the duplicate expense entry.'
        }
      }
    );
    const reversedEntry = reverseResponse.body as {
      id: string;
      entryNumber: string;
      status: string;
      reversesJournalEntryId: string | null;
      reversesJournalEntryNumber: string | null;
    };

    assert.equal(reverseResponse.status, 201);
    assert.equal(reversedEntry.entryNumber, '202605-0003');
    assert.equal(reversedEntry.status, 'POSTED');
    assert.equal(reversedEntry.reversesJournalEntryId, reverseSourceEntry.id);
    assert.equal(
      reversedEntry.reversesJournalEntryNumber,
      reverseSourceEntry.entryNumber
    );

    const correctResponse = await context.request(
      `/journal-entries/${correctSourceEntry.id}/correct`,
      {
        method: 'POST',
        headers: authHeaders,
        body: {
          entryDate: '2026-05-21',
          reason: 'Adjust the posted amount after receipt verification.',
          lines: [
            {
              accountSubjectId: expenseAccountSubject.id,
              debitAmount: 126_000,
              creditAmount: 0,
              description: 'Adjusted expense after receipt verification'
            },
            {
              accountSubjectId: fixture.assetAccountSubjectId,
              fundingAccountId: fixture.fundingAccountId,
              debitAmount: 0,
              creditAmount: 126_000,
              description: 'Adjusted cash outflow after receipt verification'
            }
          ]
        }
      }
    );
    const correctedEntry = correctResponse.body as {
      id: string;
      entryNumber: string;
      status: string;
      correctsJournalEntryId: string | null;
      correctsJournalEntryNumber: string | null;
      correctionReason: string | null;
    };

    assert.equal(correctResponse.status, 201);
    assert.equal(correctedEntry.entryNumber, '202605-0004');
    assert.equal(correctedEntry.status, 'POSTED');
    assert.equal(correctedEntry.correctsJournalEntryId, correctSourceEntry.id);
    assert.equal(
      correctedEntry.correctsJournalEntryNumber,
      correctSourceEntry.entryNumber
    );
    assert.equal(
      correctedEntry.correctionReason,
      'Adjust the posted amount after receipt verification.'
    );

    const journalEntriesResponse = await context.request('/journal-entries', {
      headers: authHeaders
    });
    const journalEntries = journalEntriesResponse.body as Array<{
      id: string;
      entryNumber: string;
      status: string;
      reversesJournalEntryId: string | null;
      reversedByJournalEntryId: string | null;
      correctsJournalEntryId: string | null;
      correctionEntryIds: string[];
      correctionReason: string | null;
      lines: Array<{
        debitAmount: number;
        creditAmount: number;
        accountSubjectCode: string;
      }>;
    }>;
    const reverseSourceAfterAdjustments =
      journalEntries.find((entry) => entry.id === reverseSourceEntry.id) ??
      null;
    const reverseAdjustment =
      journalEntries.find((entry) => entry.id === reversedEntry.id) ?? null;
    const correctSourceAfterAdjustments =
      journalEntries.find((entry) => entry.id === correctSourceEntry.id) ??
      null;
    const correctionAdjustment =
      journalEntries.find((entry) => entry.id === correctedEntry.id) ?? null;

    assert.equal(journalEntriesResponse.status, 200);
    assert.equal(journalEntries.length, 4);
    assert.equal(reverseSourceAfterAdjustments?.status, 'REVERSED');
    assert.equal(
      reverseSourceAfterAdjustments?.reversedByJournalEntryId,
      reversedEntry.id
    );
    assert.equal(
      reverseAdjustment?.reversesJournalEntryId,
      reverseSourceEntry.id
    );
    assert.equal(correctSourceAfterAdjustments?.status, 'SUPERSEDED');
    assert.deepEqual(correctSourceAfterAdjustments?.correctionEntryIds, [
      correctedEntry.id
    ]);
    assert.equal(
      correctionAdjustment?.correctsJournalEntryId,
      correctSourceEntry.id
    );
    assert.equal(
      correctionAdjustment?.correctionReason,
      'Adjust the posted amount after receipt verification.'
    );
    assert.deepEqual(
      correctionAdjustment?.lines.map((line) => ({
        accountSubjectCode: line.accountSubjectCode,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount
      })),
      [
        {
          accountSubjectCode: '5100',
          debitAmount: 126_000,
          creditAmount: 0
        },
        {
          accountSubjectCode: '1010',
          debitAmount: 0,
          creditAmount: 126_000
        }
      ]
    );

    const collectedTransactionsResponse = await context.request(
      '/collected-transactions',
      {
        headers: authHeaders
      }
    );
    const collectedTransactions = collectedTransactionsResponse.body as Array<{
      id: string;
      postingStatus: string;
    }>;

    assert.equal(collectedTransactionsResponse.status, 200);
    assert.equal(
      collectedTransactions.find((item) => item.id === reverseCollected.id)
        ?.postingStatus,
      'CORRECTED'
    );
    assert.equal(
      collectedTransactions.find((item) => item.id === correctCollected.id)
        ?.postingStatus,
      'CORRECTED'
    );

    const persistedPeriod = await context.prisma.accountingPeriod.findUnique({
      where: {
        id: openedPeriod.id
      },
      select: {
        status: true,
        nextJournalEntrySequence: true
      }
    });

    assert.equal(persistedPeriod?.status, 'OPEN');
    assert.equal(persistedPeriod?.nextJournalEntrySequence, 5);
  } finally {
    if (context && fixture) {
      await cleanupIntegrationWorkspaceFixture(context.prisma, fixture);
    }
    if (context) {
      await context.close();
    }
  }
});

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
