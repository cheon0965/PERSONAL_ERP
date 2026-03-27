import type { TransactionItem } from '@personal-erp/contracts';

export type StoredTransaction = {
  id: string;
  businessDate: Date;
  title: string;
  type: TransactionItem['type'];
  amountWon: number;
  origin: TransactionItem['origin'];
  status: TransactionItem['status'];
  account: {
    name: string;
  };
  category: {
    name: string;
  } | null;
};

export type CreateTransactionRecord = {
  userId: string;
  title: string;
  type: TransactionItem['type'];
  amountWon: number;
  businessDate: Date;
  accountId: string;
  categoryId?: string;
  memo?: string;
};

export abstract class TransactionStorePort {
  abstract findRecentByUserId(userId: string): Promise<StoredTransaction[]>;

  abstract createForUser(
    record: CreateTransactionRecord
  ): Promise<StoredTransaction>;
}
