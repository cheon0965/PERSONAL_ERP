export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type RecurringRuleItem = {
  id: string;
  title: string;
  amountWon: number;
  frequency: RecurrenceFrequency;
  nextRunDate: string | null;
  fundingAccountName: string;
  categoryName: string;
  isActive: boolean;
};

export type CreateRecurringRuleRequest = {
  title: string;
  fundingAccountId: string;
  categoryId?: string;
  amountWon: number;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
};
