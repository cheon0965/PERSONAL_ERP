import type { PrismaMoneyLike } from '../../../../common/money/prisma-money';
// eslint-disable-next-line no-restricted-imports
import type {
  CategoryKind,
  LedgerTransactionFlowKind
} from '@prisma/client';

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
  amountWon: PrismaMoneyLike;
  startDate: Date;
  endDate: Date | null;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  dayOfMonth: number | null;
  category: {
    kind: CategoryKind;
  } | null;
  ledgerTransactionType: {
    id: string;
    flowKind: LedgerTransactionFlowKind;
    isActive: boolean;
  } | null;
};

export type PlanItemGenerationTransactionType = {
  id: string;
  flowKind: LedgerTransactionFlowKind;
};

export type GeneratedPlanItemDraft = {
  tenantId: string;
  ledgerId: string;
  periodId: string;
  recurringRuleId: string;
  ledgerTransactionTypeId: string;
  fundingAccountId: string;
  categoryId?: string;
  title: string;
  plannedAmount: number;
  plannedDate: Date;
  matchedCollectedTransactionStatus: 'READY_TO_POST' | 'REVIEWED';
};

export abstract class PlanItemGenerationPort {
  abstract findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
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

  abstract createGeneratedPlanItems(
    items: GeneratedPlanItemDraft[]
  ): Promise<{
    createdCount: number;
    skippedExistingCount: number;
  }>;
}
