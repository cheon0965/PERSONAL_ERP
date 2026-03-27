import type { RecurringRuleItem } from '@personal-erp/contracts';

export type StoredRecurringRule = {
  id: string;
  title: string;
  amountWon: number;
  frequency: RecurringRuleItem['frequency'];
  nextRunDate: Date | null;
  isActive: boolean;
  account: {
    name: string;
  };
  category: {
    name: string;
  } | null;
};

export type CreateRecurringRuleRecord = {
  userId: string;
  title: string;
  accountId: string;
  categoryId?: string;
  amountWon: number;
  frequency: RecurringRuleItem['frequency'];
  dayOfMonth?: number;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  nextRunDate: Date;
};

export abstract class RecurringRuleStorePort {
  abstract findAllByUserId(userId: string): Promise<StoredRecurringRule[]>;

  abstract createForUser(
    record: CreateRecurringRuleRecord
  ): Promise<StoredRecurringRule>;
}
