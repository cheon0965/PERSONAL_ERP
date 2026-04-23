import { Injectable } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  LiabilityAgreementStatus,
  LiabilityRepaymentScheduleStatus,
  Prisma,
  PlanItemStatus
} from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  GeneratedPlanItemDraft,
  PlanItemGenerationPort
} from '../../application/ports/plan-item-generation.port';

@Injectable()
export class PrismaPlanItemGenerationAdapter implements PlanItemGenerationPort {
  constructor(private readonly prisma: PrismaService) {}

  private readonly periodSelect = {
    id: true,
    tenantId: true,
    ledgerId: true,
    year: true,
    month: true,
    startDate: true,
    endDate: true,
    status: true
  } as const;

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
      select: this.periodSelect
    });
  }

  findLatestCollectingPeriodInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        ledgerId,
        status: {
          in: [
            AccountingPeriodStatus.OPEN,
            AccountingPeriodStatus.IN_REVIEW,
            AccountingPeriodStatus.CLOSING
          ]
        }
      },
      select: this.periodSelect,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
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

  listExistingItemsForPeriod(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ) {
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

  listLiabilityRepaymentSchedulesForPeriod(
    tenantId: string,
    ledgerId: string,
    periodStartDate: Date,
    periodEndDate: Date
  ) {
    return this.prisma.liabilityRepaymentSchedule.findMany({
      where: {
        tenantId,
        ledgerId,
        dueDate: {
          gte: periodStartDate,
          lt: periodEndDate
        },
        linkedPlanItemId: null,
        status: {
          in: [
            LiabilityRepaymentScheduleStatus.SCHEDULED,
            LiabilityRepaymentScheduleStatus.PLANNED,
            LiabilityRepaymentScheduleStatus.MATCHED
          ]
        },
        agreement: {
          status: LiabilityAgreementStatus.ACTIVE
        }
      },
      select: {
        id: true,
        liabilityAgreementId: true,
        dueDate: true,
        totalAmount: true,
        agreement: {
          select: {
            lenderName: true,
            productName: true,
            defaultFundingAccountId: true,
            interestExpenseCategoryId: true,
            feeExpenseCategoryId: true
          }
        }
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
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
          const createdPlanItem = await tx.planItem.create({
            data: {
              tenantId: item.tenantId,
              ledgerId: item.ledgerId,
              periodId: item.periodId,
              recurringRuleId: item.recurringRuleId ?? null,
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
            },
            select: {
              id: true
            }
          });
          if (item.liabilityRepaymentScheduleId) {
            await tx.liabilityRepaymentSchedule.update({
              where: {
                id: item.liabilityRepaymentScheduleId
              },
              data: {
                linkedPlanItemId: createdPlanItem.id,
                status: LiabilityRepaymentScheduleStatus.MATCHED
              }
            });
          }
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
