import type {
  FundingAccountDirection,
  RecurringRuleItem
} from '@personal-erp/contracts';

export type StoredRecurringRule = {
  id: string;
  title: string;
  amountWon: number;
  frequency: RecurringRuleItem['frequency'];
  nextRunDate: Date | null;
  isActive: boolean;
  linkedInsurancePolicyId: string | null;
  ledgerTransactionTypeId: string | null;
  ledgerTransactionTypeName: string | null;
  fundingAccountDirection: FundingAccountDirection | null;
  counterpartyFundingAccountId: string | null;
  account: {
    name: string;
  };
  counterpartyAccount: { name: string } | null;
  category: {
    name: string;
  } | null;
};

export type StoredRecurringRuleDetail = {
  id: string;
  title: string;
  accountId: string;
  ledgerTransactionTypeId: string | null;
  counterpartyFundingAccountId: string | null;
  fundingAccountDirection: FundingAccountDirection | null;
  categoryId: string | null;
  amountWon: number;
  frequency: RecurringRuleItem['frequency'];
  dayOfMonth: number | null;
  startDate: Date;
  endDate: Date | null;
  nextRunDate: Date | null;
  isActive: boolean;
  linkedInsurancePolicyId: string | null;
};

export type CreateRecurringRuleRecord = {
  userId: string;
  tenantId: string;
  ledgerId: string;
  title: string;
  accountId: string;
  ledgerTransactionTypeId?: string;
  counterpartyFundingAccountId?: string;
  fundingAccountDirection?: FundingAccountDirection;
  categoryId?: string;
  amountWon: number;
  frequency: RecurringRuleItem['frequency'];
  dayOfMonth?: number;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  nextRunDate: Date;
};

export type UpdateRecurringRuleRecord = {
  id: string;
  title: string;
  accountId: string;
  ledgerTransactionTypeId?: string;
  counterpartyFundingAccountId?: string;
  fundingAccountDirection?: FundingAccountDirection;
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
  abstract findAllInWorkspace(
    tenantId: string,
    ledgerId: string
  ): Promise<StoredRecurringRule[]>;

  abstract findByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    recurringRuleId: string
  ): Promise<StoredRecurringRuleDetail | null>;

  abstract createInWorkspace(
    record: CreateRecurringRuleRecord
  ): Promise<StoredRecurringRule>;

  abstract updateInWorkspace(
    tenantId: string,
    ledgerId: string,
    record: UpdateRecurringRuleRecord
  ): Promise<StoredRecurringRule>;

  abstract deleteInWorkspace(
    tenantId: string,
    ledgerId: string,
    recurringRuleId: string
  ): Promise<boolean>;
}
