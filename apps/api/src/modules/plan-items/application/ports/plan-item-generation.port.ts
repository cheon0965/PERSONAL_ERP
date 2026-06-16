type CategoryKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type LedgerTransactionFlowKindValue =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'OPENING_BALANCE'
  | 'CARRY_FORWARD';

export type PlanItemGenerationPeriod = {
  id: string;
  tenantId: string;
  ledgerId: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: string;
};

export type PlanItemGenerationRecurringRule = {
  id: string;
  accountId: string;
  categoryId: string | null;
  title: string;
  amountWon: number;
  startDate: Date;
  endDate: Date | null;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  dayOfMonth: number | null;
  category: {
    kind: CategoryKind;
  } | null;
  ledgerTransactionType: {
    id: string;
    flowKind: LedgerTransactionFlowKindValue;
    isActive: boolean;
  } | null;
};

export type PlanItemGenerationTransactionType = {
  id: string;
  flowKind: LedgerTransactionFlowKindValue;
};

export type GeneratedPlanItemDraft = {
  tenantId: string;
  ledgerId: string;
  periodId: string;
  recurringRuleId?: string | null;
  liabilityRepaymentScheduleId?: string | null;
  ledgerTransactionTypeId: string;
  fundingAccountId: string;
  categoryId?: string;
  title: string;
  plannedAmount: number;
  plannedDate: Date;
  matchedCollectedTransactionStatus: 'READY_TO_POST' | 'REVIEWED';
};

export type PlanItemGenerationLiabilityRepaymentSchedule = {
  id: string;
  liabilityAgreementId: string;
  dueDate: Date;
  totalAmount: number;
  agreement: {
    lenderName: string;
    productName: string;
    defaultFundingAccountId: string;
    interestExpenseCategoryId: string | null;
    feeExpenseCategoryId: string | null;
  };
};

export abstract class PlanItemGenerationPort {
  abstract findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<PlanItemGenerationPeriod | null>;

  abstract findLatestCollectingPeriodInWorkspace(
    tenantId: string,
    ledgerId: string
  ): Promise<PlanItemGenerationPeriod | null>;

  abstract listRecurringRulesForPeriod(
    tenantId: string,
    ledgerId: string,
    periodStartDate: Date,
    periodEndDate: Date
  ): Promise<PlanItemGenerationRecurringRule[]>;

  abstract listExistingItemsForPeriod(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<Array<{ recurringRuleId: string | null; plannedDate: Date }>>;

  abstract listActiveTransactionTypes(
    tenantId: string,
    ledgerId: string
  ): Promise<PlanItemGenerationTransactionType[]>;

  abstract listLiabilityRepaymentSchedulesForPeriod(
    tenantId: string,
    ledgerId: string,
    periodStartDate: Date,
    periodEndDate: Date
  ): Promise<PlanItemGenerationLiabilityRepaymentSchedule[]>;

  abstract createGeneratedPlanItems(items: GeneratedPlanItemDraft[]): Promise<{
    createdCount: number;
    skippedExistingCount: number;
  }>;
}
