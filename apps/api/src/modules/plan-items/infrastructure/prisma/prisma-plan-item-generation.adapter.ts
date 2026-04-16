import { Injectable } from '@nestjs/common';
import { Prisma, PlanItemStatus } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  GeneratedPlanItemDraft,
  PlanItemGenerationPort
} from '../../application/ports/plan-item-generation.port';

@Injectable()
export class PrismaPlanItemGenerationAdapter
  implements PlanItemGenerationPort
{
  constructor(private readonly prisma: PrismaService) {}

  findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ) {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      },
      select: {
        id: true,
        tenantId: true,
        ledgerId: true,
        year: true,
        month: true,
        startDate: true,
        endDate: true,
        status: true
      }
    });
  }

  listRecurringRulesForPeriod(
    tenantId: string,
    ledgerId: string,
    periodStartDate: Date,
    periodEndDate: Date
  ) {
    return this.prisma.recurringRule.findMany({
      where: {
        tenantId,
        ledgerId,
        isActive: true,
        startDate: {
          lt: periodEndDate
        },
        OR: [{ endDate: null }, { endDate: { gte: periodStartDate } }]
      },
      include: {
        category: {
          select: {
            kind: true
          }
        },
        ledgerTransactionType: {
          select: {
            id: true,
            flowKind: true,
            isActive: true
          }
        }
      },
      orderBy: [{ nextRunDate: 'asc' }, { createdAt: 'asc' }]
    });
  }

  listExistingItemsForPeriod(tenantId: string, ledgerId: string, periodId: string) {
    return this.prisma.planItem.findMany({
      where: {
        tenantId,
        ledgerId,
        periodId
      },
      select: {
        recurringRuleId: true,
        plannedDate: true
      }
    });
  }

  listActiveTransactionTypes(tenantId: string, ledgerId: string) {
    return this.prisma.ledgerTransactionType.findMany({
      where: {
        tenantId,
        ledgerId,
        isActive: true
      },
      select: {
        id: true,
        flowKind: true
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
    });
  }

  async createGeneratedPlanItems(items: GeneratedPlanItemDraft[]) {
    let createdCount = 0;
    let skippedExistingCount = 0;

    if (items.length === 0) {
      return { createdCount, skippedExistingCount };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        try {
          await tx.planItem.create({
            data: {
              tenantId: item.tenantId,
              ledgerId: item.ledgerId,
              periodId: item.periodId,
              recurringRuleId: item.recurringRuleId,
              ledgerTransactionTypeId: item.ledgerTransactionTypeId,
              fundingAccountId: item.fundingAccountId,
              categoryId: item.categoryId,
              title: item.title,
              plannedAmount: item.plannedAmount,
              plannedDate: item.plannedDate,
              status: PlanItemStatus.MATCHED,
              matchedCollectedTransaction: {
                create: {
                  tenantId: item.tenantId,
                  ledgerId: item.ledgerId,
                  periodId: item.periodId,
                  ledgerTransactionTypeId: item.ledgerTransactionTypeId,
                  fundingAccountId: item.fundingAccountId,
                  categoryId: item.categoryId,
                  title: item.title,
                  occurredOn: item.plannedDate,
                  amount: item.plannedAmount,
                  status: item.matchedCollectedTransactionStatus
                }
              }
            }
          });
          createdCount += 1;
        } catch (error) {
          if (isPlanItemDuplicateError(error)) {
            skippedExistingCount += 1;
            continue;
          }

          throw error;
        }
      }
    });

    return { createdCount, skippedExistingCount };
  }
}

function isPlanItemDuplicateError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('periodId') &&
    error.meta.target.includes('recurringRuleId') &&
    error.meta.target.includes('plannedDate')
  );
}
