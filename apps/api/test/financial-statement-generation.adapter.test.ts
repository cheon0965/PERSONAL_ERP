import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinancialStatementPayload } from '@personal-erp/contracts';
import { FinancialStatementKind } from '@prisma/client';
import { PrismaFinancialStatementGenerationAdapter } from '../src/modules/financial-statements/infrastructure/prisma/prisma-financial-statement-generation.adapter';

type SnapshotUpsertArgs = {
  where: {
    periodId_statementKind: {
      periodId: string;
      statementKind: FinancialStatementKind;
    };
  };
  update: {
    currency: string;
    payload: unknown;
  };
  create: {
    tenantId: string;
    ledgerId: string;
    periodId: string;
    statementKind: FinancialStatementKind;
    currency: string;
    payload: unknown;
  };
};

type TransactionClient = {
  financialStatementSnapshot: {
    upsert(args: SnapshotUpsertArgs): Promise<unknown>;
  };
};

test('PrismaFinancialStatementGenerationAdapter upserts statement snapshots atomically', async () => {
  const committedSnapshots: SnapshotUpsertArgs[] = [];
  let transactionCount = 0;
  let upsertAttemptCount = 0;
  const prisma = {
    $transaction: async (
      callback: (tx: TransactionClient) => Promise<void>
    ) => {
      transactionCount += 1;
      const transactionSnapshots = [...committedSnapshots];

      await callback({
        financialStatementSnapshot: {
          upsert: async (args: SnapshotUpsertArgs) => {
            upsertAttemptCount += 1;
            transactionSnapshots.push(args);

            if (upsertAttemptCount === 2) {
              throw new Error('Simulated statement snapshot upsert failure');
            }

            return { id: `statement-snapshot-${upsertAttemptCount}` };
          }
        }
      });

      committedSnapshots.splice(
        0,
        committedSnapshots.length,
        ...transactionSnapshots
      );
    },
    financialStatementSnapshot: {
      upsert: async () => {
        throw new Error('Direct upsert should not be used');
      }
    }
  };
  const adapter = new PrismaFinancialStatementGenerationAdapter(
    prisma as never
  );

  await assert.rejects(
    adapter.upsertStatementSnapshots({
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-locked-1',
      currency: 'KRW',
      payloads: [
        [
          FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
          buildPayload('Assets')
        ],
        [FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS, buildPayload('Profit')]
      ]
    }),
    /Simulated statement snapshot upsert failure/
  );

  assert.equal(transactionCount, 1);
  assert.equal(upsertAttemptCount, 2);
  assert.equal(committedSnapshots.length, 0);
});

function buildPayload(label: string): FinancialStatementPayload {
  return {
    summary: [
      {
        label,
        amountWon: 1
      }
    ],
    sections: [],
    notes: []
  };
}
