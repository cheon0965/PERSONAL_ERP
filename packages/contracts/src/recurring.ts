export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type RecurringRuleItem = {
  id: string;
  title: string;
  amountWon: number;
  frequency: RecurrenceFrequency;
  nextRunDate: string | null;
  linkedInsurancePolicyId: string | null;
  fundingAccountName: string;
  categoryName: string;
  isActive: boolean;
};

export type RecurringRuleDetailItem = {
  id: string;
  title: string;
  fundingAccountId: string;
  categoryId: string | null;
  amountWon: number;
  frequency: RecurrenceFrequency;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  nextRunDate: string | null;
  linkedInsurancePolicyId: string | null;
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

export type UpdateRecurringRuleRequest = CreateRecurringRuleRequest;
