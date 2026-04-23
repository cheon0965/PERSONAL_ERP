import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser, PlanItemsView } from '@personal-erp/contracts';
import { AccountingPeriodStatus, Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/public';
import {
  mapPlanItemRecordToItem,
  summarizePlanItems
} from './plan-item.mapper';

const accountingPeriodViewInclude =
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

type AccountingPeriodViewRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof accountingPeriodViewInclude;
}>;

const planItemViewInclude = Prisma.validator<Prisma.PlanItemInclude>()({
  recurringRule: {
    select: {
      id: true,
      title: true
    }
  },
  ledgerTransactionType: {
    select: {
      name: true
    }
  },
  fundingAccount: {
    select: {
      name: true
    }
  },
  category: {
    select: {
      name: true
    }
  },
  matchedCollectedTransaction: {
    select: {
      id: true,
      title: true,
      status: true
    }
  },
  postedJournalEntry: {
    select: {
      id: true,
      entryNumber: true
    }
  },
  linkedLiabilityRepayment: {
    select: {
      id: true,
      liabilityAgreementId: true,
      agreement: {
        select: {
          lenderName: true,
          productName: true
        }
      }
    }
  }
});

@Injectable()
export class PlanItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findView(
    user: AuthenticatedUser,
    periodId?: string
  ): Promise<PlanItemsView | null> {
    const workspace = requireCurrentWorkspace(user);

    return this.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      periodId
    );
  }

  async findViewInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId?: string
  ): Promise<PlanItemsView | null> {
    const period = await this.findTargetPeriodInWorkspace(
      tenantId,
      ledgerId,
      periodId
    );
    if (!period) {
      return null;
    }

    return this.buildView(period);
  }

  async findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<AccountingPeriodViewRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      },
      include: accountingPeriodViewInclude
    });
  }

  async findPlanItemsInPeriod(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ) {
    const records = await this.prisma.planItem.findMany({
      where: {
        tenantId,
        ledgerId,
        periodId
      },
      include: planItemViewInclude,
      orderBy: [{ plannedDate: 'asc' }, { createdAt: 'asc' }]
    });

    return records.map(mapPlanItemRecordToItem);
  }

  private async buildView(
    period: AccountingPeriodViewRecord
  ): Promise<PlanItemsView> {
    const items = await this.findPlanItemsInPeriod(
      period.tenantId,
      period.ledgerId,
      period.id
    );

    return {
      period: mapAccountingPeriodRecordToItem(period),
      items,
      summary: summarizePlanItems(items)
    };
  }

  private async findTargetPeriodInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId?: string
  ): Promise<AccountingPeriodViewRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        ledgerId,
        ...(periodId
          ? { id: periodId }
          : {
              NOT: {
                status: AccountingPeriodStatus.LOCKED
              }
            })
      },
      include: accountingPeriodViewInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  }
}
