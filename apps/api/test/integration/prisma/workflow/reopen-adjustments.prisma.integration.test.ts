import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionType } from '@prisma/client';
import {
  cleanupIntegrationWorkspaceFixture,
  createIntegrationWorkspaceFixture,
  createRealApiPrismaIntegrationContext,
  type RealApiPrismaIntegrationContext
} from '../../../support/prisma/context';

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
