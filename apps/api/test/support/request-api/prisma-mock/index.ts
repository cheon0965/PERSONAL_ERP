import { AuditActorType, CollectedTransactionStatus } from '@prisma/client';
import { createAccountingPeriodsPrismaMock } from './accounting-periods';
import { createAdminPrismaMock } from './admin';
import { createAssetsPrismaMock } from './assets';
import { createAuthPrismaMock } from './auth';
import { createImportsPrismaMock } from './imports';
import { createLiabilitiesPrismaMock } from './liabilities';
import { createNavigationPrismaMock } from './navigation';
import { createOperationsPrismaMock } from './operations';
import { createPlanItemsPrismaMock } from './plan-items';
import { createRecurringRulesPrismaMock } from './recurring-rules';
import { createReferenceDataPrismaMock } from './reference-data';
import { createReportingPrismaMock } from './reporting';
import { createRequestPrismaMockContext } from './shared';
import { createTransactionsJournalPrismaMock } from './transactions-journal';
import type { RequestTestState } from '../types';

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
    ...createNavigationPrismaMock(context),
    ...createImportsPrismaMock(context),
    ...createLiabilitiesPrismaMock(context),
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
