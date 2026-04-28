import { PlanItemStatus } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createPlanItemsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, findPlanItem } = context;

  return {
    planItem: {
      count: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          fundingAccountId?: string;
        };
      }) => {
        return state.planItems.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesFundingAccount =
            !args.where?.fundingAccountId ||
            candidate.fundingAccountId === args.where.fundingAccountId;

          return matchesTenant && matchesLedger && matchesFundingAccount;
        }).length;
      },
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
          status?: PlanItemStatus;
          plannedAmount?: number;
          plannedDate?: {
            gte?: Date;
            lt?: Date;
          };
          fundingAccountId?: string;
          ledgerTransactionTypeId?: string;
          categoryId?: string | null;
          matchedCollectedTransaction?: {
            is?: null;
          };
        };
        select?: {
          id?: boolean;
          title?: boolean;
          plannedAmount?: boolean;
          plannedDate?: boolean;
          fundingAccountId?: boolean;
          ledgerTransactionTypeId?: boolean;
          categoryId?: boolean;
        };
        orderBy?: Array<{
          plannedDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
      }) => {
        const items = [...state.planItems]
          .filter((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesPeriod =
              !args.where?.periodId ||
              candidate.periodId === args.where.periodId;
            const matchesStatus =
              args.where?.status === undefined ||
              candidate.status === args.where.status;
            const matchesPlannedAmount =
              args.where?.plannedAmount === undefined ||
              candidate.plannedAmount === args.where.plannedAmount;
            const matchesPlannedDate =
              args.where?.plannedDate === undefined ||
              ((!args.where.plannedDate.gte ||
                candidate.plannedDate.getTime() >=
                  args.where.plannedDate.gte.getTime()) &&
                (!args.where.plannedDate.lt ||
                  candidate.plannedDate.getTime() <
                    args.where.plannedDate.lt.getTime()));
            const matchesFundingAccount =
              !args.where?.fundingAccountId ||
              candidate.fundingAccountId === args.where.fundingAccountId;
            const matchesLedgerTransactionType =
              !args.where?.ledgerTransactionTypeId ||
              candidate.ledgerTransactionTypeId ===
                args.where.ledgerTransactionTypeId;
            const matchesCategory =
              args.where?.categoryId === undefined ||
              candidate.categoryId === args.where.categoryId;
            const matchesUnmatched =
              args.where?.matchedCollectedTransaction?.is !== null ||
              !state.collectedTransactions.some(
                (transaction) => transaction.matchedPlanItemId === candidate.id
              );

            return (
              matchesTenant &&
              matchesLedger &&
              matchesPeriod &&
              matchesStatus &&
              matchesPlannedAmount &&
              matchesPlannedDate &&
              matchesFundingAccount &&
              matchesLedgerTransactionType &&
              matchesCategory &&
              matchesUnmatched
            );
          })
          .sort((left, right) => {
            const plannedDateDiff =
              left.plannedDate.getTime() - right.plannedDate.getTime();
            if (plannedDateDiff !== 0) {
              return plannedDateDiff;
            }

            return left.createdAt.getTime() - right.createdAt.getTime();
          });

        return items.map((candidate) => {
          if (!args.select) {
            return candidate;
          }

          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.title ? { title: candidate.title } : {}),
            ...(args.select.plannedAmount
              ? { plannedAmount: candidate.plannedAmount }
              : {}),
            ...(args.select.plannedDate
              ? { plannedDate: candidate.plannedDate }
              : {}),
            ...(args.select.fundingAccountId
              ? { fundingAccountId: candidate.fundingAccountId }
              : {}),
            ...(args.select.ledgerTransactionTypeId
              ? { ledgerTransactionTypeId: candidate.ledgerTransactionTypeId }
              : {}),
            ...(args.select.categoryId
              ? { categoryId: candidate.categoryId }
              : {})
          };
        });
      },
      update: async (args: {
        where: {
          id: string;
        };
        data: {
          status?: PlanItemStatus;
        };
      }) => {
        const candidate = findPlanItem(args.where.id);
        if (!candidate) {
          throw new Error('Plan item not found');
        }

        if (args.data.status) {
          candidate.status = args.data.status;
        }

        candidate.updatedAt = new Date();
        return candidate;
      },
      updateMany: async (args: {
        where?: {
          id?:
            | string
            | {
                in?: string[];
              };
          tenantId?: string;
          ledgerId?: string;
          status?: PlanItemStatus;
        };
        data: {
          status?: PlanItemStatus;
        };
      }) => {
        let updatedCount = 0;
        state.planItems.forEach((candidate) => {
          const matchesId =
            !args.where?.id ||
            (typeof args.where.id === 'string'
              ? candidate.id === args.where.id
              : !args.where.id.in || args.where.id.in.includes(candidate.id));
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesStatus =
            !args.where?.status || candidate.status === args.where.status;

          if (
            !matchesId ||
            !matchesTenant ||
            !matchesLedger ||
            !matchesStatus
          ) {
            return;
          }

          if (args.data.status) {
            candidate.status = args.data.status;
          }

          candidate.updatedAt = new Date();
          updatedCount += 1;
        });

        return {
          count: updatedCount
        };
      }
    }
  };
}
