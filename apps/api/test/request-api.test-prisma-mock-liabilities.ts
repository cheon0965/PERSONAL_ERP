import { LiabilityRepaymentScheduleStatus } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createLiabilitiesPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
    liabilityRepaymentSchedule: {
      updateMany: async (args: {
        where?: {
          linkedPlanItemId?: string | { in?: string[] };
          tenantId?: string;
          ledgerId?: string;
          postedJournalEntryId?: string | null;
          status?:
            | LiabilityRepaymentScheduleStatus
            | { in?: LiabilityRepaymentScheduleStatus[] };
        };
        data: {
          status?: LiabilityRepaymentScheduleStatus;
          postedJournalEntryId?: string | null;
        };
      }) => {
        let updatedCount = 0;

        state.liabilityRepaymentSchedules.forEach((candidate) => {
          const matchesLinkedPlanItemId = matchesStringFilter(
            candidate.linkedPlanItemId,
            args.where?.linkedPlanItemId
          );
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPostedJournalEntry =
            args.where?.postedJournalEntryId === undefined ||
            candidate.postedJournalEntryId === args.where.postedJournalEntryId;
          const matchesStatus = matchesStatusFilter(
            candidate.status,
            args.where?.status
          );

          if (
            !matchesLinkedPlanItemId ||
            !matchesTenant ||
            !matchesLedger ||
            !matchesPostedJournalEntry ||
            !matchesStatus
          ) {
            return;
          }

          if (args.data.status) {
            candidate.status = args.data.status;
          }

          if ('postedJournalEntryId' in args.data) {
            candidate.postedJournalEntryId =
              args.data.postedJournalEntryId ?? null;
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

function matchesStringFilter(
  value: string | null,
  filter?: string | { in?: string[] }
) {
  if (!filter) {
    return true;
  }

  if (typeof filter === 'string') {
    return value === filter;
  }

  return !filter.in || (value !== null && filter.in.includes(value));
}

function matchesStatusFilter(
  value: LiabilityRepaymentScheduleStatus,
  filter?:
    | LiabilityRepaymentScheduleStatus
    | { in?: LiabilityRepaymentScheduleStatus[] }
) {
  if (!filter) {
    return true;
  }

  if (typeof filter === 'string') {
    return value === filter;
  }

  return !filter.in || filter.in.includes(value);
}
