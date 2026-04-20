// eslint-disable-next-line no-restricted-imports
import type {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  JournalEntryStatus,
  PostingPolicyKey,
  Prisma
} from '@prisma/client';
import type { JournalEntryRecord } from '../../../journal-entries/public';

export type ConfirmationWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

export type ConfirmationCollectedTransaction = {
  id: string;
  occurredOn: Date;
  title: string;
  memo: string | null;
  amount: number;
  status: CollectedTransactionStatus;
  matchedPlanItemId: string | null;
  period: {
    id: string;
    year: number;
    month: number;
    status: AccountingPeriodStatus;
  } | null;
  fundingAccount: {
    id: string;
    name: string;
  };
  ledgerTransactionType: {
    postingPolicyKey: PostingPolicyKey;
  };
  importedRow: {
    id: string;
    batchId: string;
    rawPayload: Prisma.JsonValue;
  } | null;
  postedJournalEntry: {
    id: string;
  } | null;
};

export type ConfirmationReversalTarget = {
  id: string;
  createdCollectedTransaction: {
    id: string;
    status: CollectedTransactionStatus;
    postedJournalEntry: {
      id: string;
      entryNumber: string;
      status: JournalEntryStatus;
      lines: Array<{
        accountSubjectId: string;
        fundingAccountId: string | null;
        debitAmount: Prisma.Decimal;
        creditAmount: Prisma.Decimal;
        description: string | null;
      }>;
    } | null;
  } | null;
};

export type AllocatedConfirmationEntryNumber = {
  period: {
    id: string;
    year: number;
    month: number;
  };
  sequence: number;
};

export type ConfirmationJournalLine = {
  lineNumber: number;
  accountSubjectId: string;
  fundingAccountId?: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
};

export type CreateConfirmationJournalEntryInput = {
  tenantId: string;
  ledgerId: string;
  periodId: string;
  entryNumber: string;
  entryDate: Date;
  sourceKind: JournalEntrySourceKind;
  sourceCollectedTransactionId: string;
  status: JournalEntryStatus;
  memo: string;
  createdByActorType: AuditActorType;
  createdByMembershipId: string;
  lines: ConfirmationJournalLine[];
  reversesJournalEntryId?: string | null;
  correctsJournalEntryId?: string | null;
  correctionReason?: string | null;
};

export abstract class ConfirmTransactionContext {
  abstract findLatestForConfirmation(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<ConfirmationCollectedTransaction | null>;

  abstract allocateJournalEntryNumber(
    scope: ConfirmationWorkspaceScope,
    periodId: string
  ): Promise<AllocatedConfirmationEntryNumber>;

  abstract claimForConfirmation(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    currentStatus: CollectedTransactionStatus;
  }): Promise<{ count: number }>;

  abstract assertClaimSucceeded(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    updatedCount: number;
  }): Promise<void>;

  abstract createJournalEntry(
    input: CreateConfirmationJournalEntryInput
  ): Promise<JournalEntryRecord>;

  abstract markMatchedPlanItemConfirmed(
    matchedPlanItemId: string | null | undefined
  ): Promise<void>;

  abstract findReversalTarget(
    scope: ConfirmationWorkspaceScope,
    importBatchId: string,
    rowNumber: number
  ): Promise<ConfirmationReversalTarget | null>;

  abstract updateJournalEntryStatusInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    journalEntryId: string;
    expectedStatuses: JournalEntryStatus[];
    nextStatus: JournalEntryStatus;
  }): Promise<number>;

  abstract findCurrentJournalEntryStatusInWorkspace(
    scope: ConfirmationWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryStatus | null>;

  abstract updateCollectedTransactionStatusInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    expectedStatuses: CollectedTransactionStatus[];
    nextStatus: CollectedTransactionStatus;
  }): Promise<number>;

  abstract findCurrentCollectedTransactionStatusInWorkspace(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<CollectedTransactionStatus | null>;
}

export abstract class ConfirmCollectedTransactionStorePort {
  abstract findForConfirmation(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<ConfirmationCollectedTransaction | null>;

  abstract findActiveAccountSubjects(
    scope: ConfirmationWorkspaceScope,
    codes: readonly string[]
  ): Promise<Array<{ id: string; code: string }>>;

  abstract runInTransaction<T>(
    fn: (ctx: ConfirmTransactionContext) => Promise<T>
  ): Promise<T>;
}
