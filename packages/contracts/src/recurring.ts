import type { MoneyWon } from './money';
import type { FundingAccountDirection } from './transactions';

export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type RecurringRuleItem = {
  id: string;
  title: string;
  amountWon: MoneyWon;
  frequency: RecurrenceFrequency;
  nextRunDate: string | null;
  linkedInsurancePolicyId: string | null;
  ledgerTransactionTypeId?: string | null;
  ledgerTransactionTypeName?: string | null;
  fundingAccountDirection?: FundingAccountDirection | null;
  fundingAccountName: string;
  counterpartyFundingAccountId?: string | null;
  counterpartyFundingAccountName?: string | null;
  categoryName: string;
  isActive: boolean;
};

export type RecurringRuleDetailItem = {
  id: string;
  title: string;
  fundingAccountId: string;
  ledgerTransactionTypeId?: string | null;
  counterpartyFundingAccountId?: string | null;
  fundingAccountDirection?: FundingAccountDirection | null;
  categoryId: string | null;
  amountWon: MoneyWon;
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
  ledgerTransactionTypeId?: string;
  counterpartyFundingAccountId?: string;
  fundingAccountDirection?: FundingAccountDirection;
  categoryId?: string;
  amountWon: MoneyWon;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
};

export type UpdateRecurringRuleRequest = CreateRecurringRuleRequest;
