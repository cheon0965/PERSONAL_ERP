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
};

export type CreateCollectedTransactionRecord = {
  userId: string;
  title: string;
  type: CollectedTransactionItem['type'];
  amountWon: number;
  businessDate: Date;
  fundingAccountId: string;
  categoryId?: string;
  memo?: string;
};

export abstract class CollectedTransactionStorePort {
  abstract findRecentByUserId(
    userId: string
  ): Promise<StoredCollectedTransaction[]>;

  abstract createForUser(
    record: CreateCollectedTransactionRecord
  ): Promise<StoredCollectedTransaction>;
}
