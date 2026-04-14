import { AuditActorType, CollectedTransactionStatus } from '@prisma/client';
import { createAccountingPeriodsPrismaMock } from './request-api.test-prisma-mock-accounting-periods';
import { createAdminPrismaMock } from './request-api.test-prisma-mock-admin';
import { createAssetsPrismaMock } from './request-api.test-prisma-mock-assets';
import { createAuthPrismaMock } from './request-api.test-prisma-mock-auth';
import { createImportsPrismaMock } from './request-api.test-prisma-mock-imports';
import { createOperationsPrismaMock } from './request-api.test-prisma-mock-operations';
import { createPlanItemsPrismaMock } from './request-api.test-prisma-mock-plan-items';
import { createRecurringRulesPrismaMock } from './request-api.test-prisma-mock-recurring-rules';
import { createReferenceDataPrismaMock } from './request-api.test-prisma-mock-reference-data';
import { createReportingPrismaMock } from './request-api.test-prisma-mock-reporting';
import { createRequestPrismaMockContext } from './request-api.test-prisma-mock-shared';
import { createTransactionsJournalPrismaMock } from './request-api.test-prisma-mock-transactions-journal';
import type { RequestTestState } from './request-api.test-types';

function applyOneShotTransactionSimulations(state: RequestTestState) {
  const collectedTransactionId =
    state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId;

  if (!collectedTransactionId) {
    return;
  }

  state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId = null;

  const collectedTransaction = state.collectedTransactions.find(
    (candidate) => candidate.id === collectedTransactionId
  );

  if (!collectedTransaction) {
    return;
  }

  collectedTransaction.status = CollectedTransactionStatus.POSTED;
  collectedTransaction.updatedAt = new Date();

  const existingJournalEntry = state.journalEntries.find(
    (candidate) =>
      candidate.sourceCollectedTransactionId === collectedTransaction.id
  );

  if (existingJournalEntry) {
    return;
  }

  state.journalEntries.push({
    id: `simulated-journal-entry-${state.journalEntries.length + 1}`,
    tenantId: collectedTransaction.tenantId,
    ledgerId: collectedTransaction.ledgerId,
    periodId: collectedTransaction.periodId ?? 'simulated-period',
    entryNumber: `SIM-${String(state.journalEntries.length + 1).padStart(4, '0')}`,
    entryDate: new Date(collectedTransaction.occurredOn),
    sourceKind: 'COLLECTED_TRANSACTION',
    sourceCollectedTransactionId: collectedTransaction.id,
    reversesJournalEntryId: null,
    correctsJournalEntryId: null,
    correctionReason: null,
    status: 'POSTED',
    memo: collectedTransaction.memo,
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: 'membership-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: []
  });
}

export function createPrismaMock(
  state: RequestTestState
): Record<string, unknown> {
  const context = createRequestPrismaMockContext(state);
  return {
    $queryRaw: async () => {
      if (!state.databaseReady) {
        throw new Error('Database unavailable');
      }

      return [{ ready: 1 }];
    },
    $transaction: async <T>(
      callback: (tx: Record<string, unknown>) => Promise<T>
    ) => {
      applyOneShotTransactionSimulations(state);
      const transactionState = structuredClone(state);
      const result = await callback(createPrismaMock(transactionState));
      Object.assign(state, transactionState);
      return result;
    },
    ...createAuthPrismaMock(context),
    ...createAdminPrismaMock(context),
    ...createImportsPrismaMock(context),
    ...createOperationsPrismaMock(context),
    ...createPlanItemsPrismaMock(context),
    ...createAccountingPeriodsPrismaMock(context),
    ...createReportingPrismaMock(context),
    ...createReferenceDataPrismaMock(context),
    ...createTransactionsJournalPrismaMock(context),
    ...createRecurringRulesPrismaMock(context),
    ...createAssetsPrismaMock(context)
  };
}
