import type {
  CollectedTransactionItem,
  CollectedTransactionPostingStatus,
  CollectedTransactionSourceKind
} from '@personal-erp/contracts';

export type StoredCollectedTransaction = {
  id: string;
  businessDate: Date;
  title: string;
  type: CollectedTransactionItem['type'];
  amountWon: number;
  origin: CollectedTransactionSourceKind;
  status: CollectedTransactionPostingStatus;
  account: {
    name: string;
  };
  category: {
    name: string;
  } | null;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
};

export type StoredCollectedTransactionDetail = {
  id: string;
  businessDate: Date;
  title: string;
  type: CollectedTransactionItem['type'];
  amountWon: number;
  fundingAccountId: string;
  categoryId: string | null;
  memo: string | null;
  origin: CollectedTransactionSourceKind;
  status: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
};

export type CollectedTransactionWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

export type CreateCollectedTransactionRecord = {
  tenantId: string;
  ledgerId: string;
  periodId: string;
  title: string;
  type: CollectedTransactionItem['type'];
  amountWon: number;
  businessDate: Date;
  fundingAccountId: string;
  categoryId?: string;
  memo?: string;
};

export type UpdateCollectedTransactionRecord = {
  id: string;
  periodId: string;
  title: string;
  type: CollectedTransactionItem['type'];
  amountWon: number;
  businessDate: Date;
  fundingAccountId: string;
  categoryId?: string;
  memo?: string;
};

export abstract class CollectedTransactionStorePort {
  abstract findRecentInWorkspace(
    workspace: CollectedTransactionWorkspaceScope
  ): Promise<StoredCollectedTransaction[]>;

  abstract findByIdInWorkspace(
    workspace: CollectedTransactionWorkspaceScope,
    collectedTransactionId: string
  ): Promise<StoredCollectedTransactionDetail | null>;

  abstract createInWorkspace(
    record: CreateCollectedTransactionRecord
  ): Promise<StoredCollectedTransaction>;

  abstract updateInWorkspace(
    workspace: CollectedTransactionWorkspaceScope,
    record: UpdateCollectedTransactionRecord
  ): Promise<StoredCollectedTransaction>;

  abstract deleteInWorkspace(
    workspace: CollectedTransactionWorkspaceScope,
    collectedTransactionId: string
  ): Promise<boolean>;
}