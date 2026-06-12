import type {
  AuditActorType,
  JournalEntryItem,
  JournalEntrySourceKind,
  JournalEntryStatus
} from '@personal-erp/contracts';
import type { JournalAdjustmentLineDraft } from '../../domain/journal-entry-adjustment.policy';

export type JournalEntryWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

export type JournalEntryCreationActorRef = {
  createdByActorType: AuditActorType;
  createdByMembershipId: string;
};

export type CollectedTransactionStatusValue =
  | 'COLLECTED'
  | 'REVIEWED'
  | 'READY_TO_POST'
  | 'POSTED'
  | 'CORRECTED'
  | 'LOCKED';

export type JournalEntryAdjustmentRecord = {
  id: string;
  entryNumber: string;
  status: JournalEntryStatus;
  sourceCollectedTransaction: {
    id: string;
    status: CollectedTransactionStatusValue;
  } | null;
  lines: Array<{
    accountSubjectId: string;
    fundingAccountId: string | null;
    debitAmount: number;
    creditAmount: number;
    description: string | null;
  }>;
};

export type CreateJournalEntryAdjustmentInput = {
  workspace: JournalEntryWorkspaceScope;
  periodId: string;
  entryNumber: string;
  entryDate: Date;
  sourceKind: JournalEntrySourceKind;
  status: JournalEntryStatus;
  memo: string | null;
  actorRef: JournalEntryCreationActorRef;
  lines: JournalAdjustmentLineDraft[];
  reversesJournalEntryId?: string | null;
  correctsJournalEntryId?: string | null;
  correctionReason?: string | null;
};

export type AllocatedAdjustmentEntryNumber = {
  period: {
    id: string;
    year: number;
    month: number;
  };
  sequence: number;
};

export abstract class JournalEntryAdjustmentContext {
  abstract allocateJournalEntryNumber(
    workspace: JournalEntryWorkspaceScope,
    periodId: string
  ): Promise<AllocatedAdjustmentEntryNumber>;

  abstract findByIdInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryAdjustmentRecord | null>;

  abstract updateStatusInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string,
    expectedStatuses: JournalEntryStatus[],
    nextStatus: JournalEntryStatus
  ): Promise<number>;

  abstract findCurrentStatusInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryStatus | null>;

  abstract updateCollectedTransactionStatusInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string,
    expectedStatuses: CollectedTransactionStatusValue[],
    nextStatus: CollectedTransactionStatusValue
  ): Promise<number>;

  abstract findCollectedTransactionStatusInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string
  ): Promise<CollectedTransactionStatusValue | null>;

  abstract restoreMatchedPlanningStateAfterReversal(
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string,
    journalEntryId: string
  ): Promise<void>;

  abstract createAdjustmentEntry(
    input: CreateJournalEntryAdjustmentInput
  ): Promise<JournalEntryItem>;

  abstract assertAdjustmentReferencesExist(
    workspace: JournalEntryWorkspaceScope,
    lines: JournalAdjustmentLineDraft[]
  ): Promise<void>;
}

export abstract class JournalEntryAdjustmentStorePort {
  abstract runInTransaction<T>(
    fn: (ctx: JournalEntryAdjustmentContext) => Promise<T>
  ): Promise<T>;
}
