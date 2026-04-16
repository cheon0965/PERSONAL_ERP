import type {
  AuditActorType,
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  JournalEntryStatus,
  Prisma
} from '@prisma/client';
import type { JournalAdjustmentLineDraft } from '../../journal-entry-adjustment.policy';
import type { JournalEntryItemRecord } from '../../journal-entry.record';

export type JournalEntryWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

export type JournalEntryCreationActorRef = {
  createdByActorType: AuditActorType;
  createdByMembershipId: string;
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

export abstract class JournalEntryAdjustmentStorePort {
  abstract findByIdInWorkspace(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryItemRecord | null>;

  abstract updateStatusInWorkspace(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string,
    expectedStatuses: JournalEntryStatus[],
    nextStatus: JournalEntryStatus
  ): Promise<number>;

  abstract findCurrentStatusInWorkspace(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryStatus | null>;

  abstract updateCollectedTransactionStatusInWorkspace(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string,
    expectedStatuses: CollectedTransactionStatus[],
    nextStatus: CollectedTransactionStatus
  ): Promise<number>;

  abstract findCollectedTransactionStatusInWorkspace(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string
  ): Promise<CollectedTransactionStatus | null>;

  abstract createAdjustmentEntry(
    tx: Prisma.TransactionClient,
    input: CreateJournalEntryAdjustmentInput
  ): Promise<JournalEntryItemRecord>;

  abstract assertAdjustmentReferencesExist(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    lines: JournalAdjustmentLineDraft[]
  ): Promise<void>;
}
