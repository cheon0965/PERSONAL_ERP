import { Prisma } from '@prisma/client';

export const createdCollectedTransactionSelect =
  Prisma.validator<Prisma.CollectedTransactionSelect>()({
    id: true,
    occurredOn: true,
    title: true,
    amount: true,
    fundingAccount: {
      select: {
        name: true
      }
    },
    category: {
      select: {
        name: true
      }
    }
  });

export const collectableImportedRowSelect =
  Prisma.validator<Prisma.ImportedRowSelect>()({
    id: true,
    parseStatus: true,
    rawPayload: true,
    sourceFingerprint: true,
    createdCollectedTransaction: {
      select: {
        id: true
      }
    },
    batch: {
      select: {
        sourceKind: true
      }
    }
  });

export const collectingPeriodSelect =
  Prisma.validator<Prisma.AccountingPeriodSelect>()({
    id: true,
    startDate: true,
    endDate: true
  });

export type CreatedCollectedTransactionRecord =
  Prisma.CollectedTransactionGetPayload<{
    select: typeof createdCollectedTransactionSelect;
  }>;

export type CollectableImportedRow = Prisma.ImportedRowGetPayload<{
  select: typeof collectableImportedRowSelect;
}>;

export type CollectingPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  select: typeof collectingPeriodSelect;
}>;

export type DraftPlanItemCandidate = {
  id: string;
  plannedAmount: number;
  plannedDate: Date;
  fundingAccountId: string;
  ledgerTransactionTypeId: string;
  categoryId: string | null;
};
