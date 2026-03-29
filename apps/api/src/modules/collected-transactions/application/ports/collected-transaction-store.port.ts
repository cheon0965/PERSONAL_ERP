import type { CollectedTransactionItem } from '@personal-erp/contracts';

export type StoredCollectedTransaction = {
  id: string;
  businessDate: Date;
  title: string;
  type: CollectedTransactionItem['type'];
  amountWon: number;
  origin: CollectedTransactionItem['sourceKind'];
  status: CollectedTransactionItem['postingStatus'];
  account: {
    name: string;
  };
  category: {
    name: string;
  } | null;
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

export abstract class CollectedTransactionStorePort {
  abstract findRecentInWorkspace(
    workspace: CollectedTransactionWorkspaceScope
  ): Promise<StoredCollectedTransaction[]>;

  abstract createInWorkspace(
    record: CreateCollectedTransactionRecord
  ): Promise<StoredCollectedTransaction>;
}
