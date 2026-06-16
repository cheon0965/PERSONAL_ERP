import assert from 'node:assert/strict';
import test from 'node:test';
import { ImportSourceKind, TransactionType } from '@prisma/client';
import {
  cleanupIntegrationWorkspaceFixture,
  createIntegrationWorkspaceFixture,
  createRealApiPrismaIntegrationContext,
  type RealApiPrismaIntegrationContext
} from '../../../support/prisma/context';

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
