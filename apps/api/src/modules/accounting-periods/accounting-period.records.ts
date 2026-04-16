import { Prisma } from '@prisma/client';

export const accountingPeriodInclude =
  Prisma.validator<Prisma.AccountingPeriodInclude>()({
    openingBalanceSnapshot: {
      select: {
        sourceKind: true
      }
    },
    statusHistory: {
      orderBy: {
        changedAt: 'desc'
      },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        eventType: true,
        reason: true,
        actorType: true,
        actorMembershipId: true,
        changedAt: true
      }
    }
  });

export type AccountingPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof accountingPeriodInclude;
}>;
