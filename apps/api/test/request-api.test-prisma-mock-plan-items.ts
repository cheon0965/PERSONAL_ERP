import { PlanItemStatus } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createPlanItemsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, findPlanItem } = context;

  return {
    planItem: {
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
          status?: PlanItemStatus;
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
          id?: {
            in?: string[];
          };
          tenantId?: string;
          ledgerId?: string;
        };
        data: {
          status?: PlanItemStatus;
        };
      }) => {
        let updatedCount = 0;
        state.planItems.forEach((candidate) => {
          const matchesId =
            !args.where?.id?.in || args.where.id.in.includes(candidate.id);
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          if (!matchesId || !matchesTenant || !matchesLedger) {
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
