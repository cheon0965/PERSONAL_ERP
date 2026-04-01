import type { PlanItemItem, PlanItemSummary } from '@personal-erp/contracts';
import type { PlanItemStatus } from '@prisma/client';

type PlanItemRecord = {
  id: string;
  periodId: string;
  title: string;
  plannedDate: Date;
  plannedAmount: number;
  status: PlanItemStatus;
  recurringRule: {
    id: string;
    title: string;
  } | null;
  ledgerTransactionType: {
    name: string;
  };
  fundingAccount: {
    name: string;
  };
  category: {
    name: string;
  } | null;
  matchedCollectedTransaction: {
    id: string;
  } | null;
  postedJournalEntry: {
    id: string;
  } | null;
};

export function mapPlanItemRecordToItem(record: PlanItemRecord): PlanItemItem {
  return {
    id: record.id,
    periodId: record.periodId,
    title: record.title,
    plannedDate: record.plannedDate.toISOString().slice(0, 10),
    plannedAmount: record.plannedAmount,
    status: record.status,
    recurringRuleId: record.recurringRule?.id ?? null,
    recurringRuleTitle: record.recurringRule?.title ?? null,
    ledgerTransactionTypeName: record.ledgerTransactionType.name,
    fundingAccountName: record.fundingAccount.name,
    categoryName: record.category?.name ?? '-',
    matchedCollectedTransactionId:
      record.matchedCollectedTransaction?.id ?? null,
    postedJournalEntryId: record.postedJournalEntry?.id ?? null
  };
}

export function summarizePlanItems(
  items: Pick<PlanItemItem, 'plannedAmount' | 'status'>[]
): PlanItemSummary {
  return items.reduce<PlanItemSummary>(
    (summary, item) => {
      summary.totalCount += 1;
      summary.totalPlannedAmount += item.plannedAmount;

      switch (item.status) {
        case 'DRAFT':
          summary.draftCount += 1;
          break;
        case 'MATCHED':
          summary.matchedCount += 1;
          break;
        case 'CONFIRMED':
          summary.confirmedCount += 1;
          break;
        case 'SKIPPED':
          summary.skippedCount += 1;
          break;
        case 'EXPIRED':
          summary.expiredCount += 1;
          break;
        default:
          break;
      }

      return summary;
    },
    {
      totalCount: 0,
      totalPlannedAmount: 0,
      draftCount: 0,
      matchedCount: 0,
      confirmedCount: 0,
      skippedCount: 0,
      expiredCount: 0
    }
  );
}
