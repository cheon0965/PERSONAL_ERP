import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  GeneratePlanItemsRequest,
  GeneratePlanItemsResponse,
  PlanItemsView
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  CategoryKind,
  LedgerTransactionFlowKind
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import {
  mapPlanItemRecordToItem,
  summarizePlanItems
} from './plan-item.mapper';

const MAX_OCCURRENCE_ITERATIONS = 400;

@Injectable()
export class PlanItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findView(
    user: AuthenticatedUser,
    periodId?: string
  ): Promise<PlanItemsView | null> {
    const workspace = requireCurrentWorkspace(user);
    const period = await this.resolveTargetPeriod(
      workspace.tenantId,
      workspace.ledgerId,
      periodId
    );

    if (!period) {
      return null;
    }

    const items = await this.findPlanItemsInPeriod(
      workspace.tenantId,
      workspace.ledgerId,
      period.id
    );

    return {
      period: mapAccountingPeriodRecordToItem(period),
      items,
      summary: summarizePlanItems(items)
    };
  }

  async generate(
    user: AuthenticatedUser,
    input: GeneratePlanItemsRequest
  ): Promise<GeneratePlanItemsResponse> {
    const workspace = requireCurrentWorkspace(user);
    this.assertGeneratePermission(workspace.membershipRole);

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        id: input.periodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: {
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
            reason: true,
            actorType: true,
            actorMembershipId: true,
            changedAt: true
          }
        }
      }
    });

    if (!period) {
      throw new NotFoundException(
        '계획 항목을 생성할 운영 기간을 찾을 수 없습니다.'
      );
    }

    if (period.status === AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException(
        '잠금된 운영 기간에는 새로운 계획 항목을 생성할 수 없습니다.'
      );
    }

    const [recurringRules, existingItems, transactionTypes] = await Promise.all([
      this.prisma.recurringRule.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          isActive: true,
          startDate: {
            lt: period.endDate
          },
          OR: [{ endDate: null }, { endDate: { gte: period.startDate } }]
        },
        include: {
          account: {
            select: {
              id: true,
              name: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
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
      }),
      this.prisma.planItem.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id
        },
        select: {
          recurringRuleId: true,
          plannedDate: true
        }
      }),
      this.prisma.ledgerTransactionType.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          isActive: true
        },
        select: {
          id: true,
          flowKind: true
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
      })
    ]);

    const defaultTypeIdByFlow = new Map<LedgerTransactionFlowKind, string>();
    for (const transactionType of transactionTypes) {
      if (!defaultTypeIdByFlow.has(transactionType.flowKind)) {
        defaultTypeIdByFlow.set(transactionType.flowKind, transactionType.id);
      }
    }

    const existingKeys = new Set(
      existingItems
        .filter((item) => item.recurringRuleId)
        .map(
          (item) =>
            `${item.recurringRuleId}:${item.plannedDate.toISOString().slice(0, 10)}`
        )
    );

    const createData: Array<{
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
    }> = [];
    let skippedExistingCount = 0;
    let excludedRuleCount = 0;

    for (const rule of recurringRules) {
      const plannedDates = buildPlannedDates(rule, period.startDate, period.endDate);
      if (plannedDates.length === 0) {
        continue;
      }

      const ledgerTransactionTypeId = resolveLedgerTransactionTypeId(
        rule.ledgerTransactionType,
        rule.category?.kind ?? null,
        defaultTypeIdByFlow
      );

      if (!ledgerTransactionTypeId) {
        excludedRuleCount += 1;
        continue;
      }

      for (const plannedDate of plannedDates) {
        const duplicateKey = `${rule.id}:${plannedDate.toISOString().slice(0, 10)}`;
        if (existingKeys.has(duplicateKey)) {
          skippedExistingCount += 1;
          continue;
        }

        existingKeys.add(duplicateKey);
        createData.push({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          recurringRuleId: rule.id,
          ledgerTransactionTypeId,
          fundingAccountId: rule.accountId,
          categoryId: rule.categoryId ?? undefined,
          title: rule.title,
          plannedAmount: rule.amountWon,
          plannedDate
        });
      }
    }

    if (createData.length > 0) {
      await this.prisma.planItem.createMany({
        data: createData
      });
    }

    const items = await this.findPlanItemsInPeriod(
      workspace.tenantId,
      workspace.ledgerId,
      period.id
    );

    return {
      period: mapAccountingPeriodRecordToItem(period),
      items,
      summary: summarizePlanItems(items),
      generation: {
        createdCount: createData.length,
        skippedExistingCount,
        excludedRuleCount
      }
    };
  }

  private assertGeneratePermission(
    membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
  ) {
    if (
      membershipRole === 'OWNER' ||
      membershipRole === 'MANAGER' ||
      membershipRole === 'EDITOR'
    ) {
      return;
    }

    throw new ForbiddenException(
      '계획 항목 생성은 Owner, Manager, Editor만 실행할 수 있습니다.'
    );
  }

  private async resolveTargetPeriod(
    tenantId: string,
    ledgerId: string,
    periodId?: string
  ) {
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
      include: {
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
            reason: true,
            actorType: true,
            actorMembershipId: true,
            changedAt: true
          }
        }
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  }

  private async findPlanItemsInPeriod(
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
      include: {
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
            id: true
          }
        },
        postedJournalEntry: {
          select: {
            id: true
          }
        }
      },
      orderBy: [{ plannedDate: 'asc' }, { createdAt: 'asc' }]
    });

    return records.map(mapPlanItemRecordToItem);
  }
}

function resolveLedgerTransactionTypeId(
  explicitType:
    | {
        id: string;
        flowKind: LedgerTransactionFlowKind;
        isActive: boolean;
      }
    | null,
  categoryKind: CategoryKind | null,
  defaultTypeIdByFlow: Map<LedgerTransactionFlowKind, string>
) {
  if (explicitType?.isActive) {
    return explicitType.id;
  }

  switch (categoryKind) {
    case CategoryKind.INCOME:
      return defaultTypeIdByFlow.get(LedgerTransactionFlowKind.INCOME) ?? null;
    case CategoryKind.EXPENSE:
      return defaultTypeIdByFlow.get(LedgerTransactionFlowKind.EXPENSE) ?? null;
    case CategoryKind.TRANSFER:
      return defaultTypeIdByFlow.get(LedgerTransactionFlowKind.TRANSFER) ?? null;
    default:
      return null;
  }
}

function buildPlannedDates(
  rule: {
    startDate: Date;
    endDate: Date | null;
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    dayOfMonth: number | null;
  },
  periodStart: Date,
  periodEndExclusive: Date
) {
  switch (rule.frequency) {
    case 'WEEKLY':
      return buildWeeklyDates(rule, periodStart, periodEndExclusive);
    case 'MONTHLY':
      return buildMonthlyLikeDates(rule, periodStart, periodEndExclusive, 1);
    case 'QUARTERLY':
      return buildMonthlyLikeDates(rule, periodStart, periodEndExclusive, 3);
    case 'YEARLY':
      return buildMonthlyLikeDates(rule, periodStart, periodEndExclusive, 12);
    default:
      return [];
  }
}

function buildWeeklyDates(
  rule: {
    startDate: Date;
    endDate: Date | null;
  },
  periodStart: Date,
  periodEndExclusive: Date
) {
  const start = toUtcDateOnly(rule.startDate);
  const ruleEnd = rule.endDate ? toUtcDateOnly(rule.endDate) : null;
  const periodStartDay = toUtcDateOnly(periodStart);
  const periodEndDay = toUtcDateOnly(periodEndExclusive);
  const dates: Date[] = [];

  let cursor = start;
  for (
    let iteration = 0;
    iteration < MAX_OCCURRENCE_ITERATIONS && cursor < periodEndDay;
    iteration += 1
  ) {
    if (
      cursor >= periodStartDay &&
      cursor < periodEndDay &&
      (!ruleEnd || cursor <= ruleEnd)
    ) {
      dates.push(cursor);
    }

    cursor = addDays(cursor, 7);
  }

  return dates;
}

function buildMonthlyLikeDates(
  rule: {
    startDate: Date;
    endDate: Date | null;
    dayOfMonth: number | null;
  },
  periodStart: Date,
  periodEndExclusive: Date,
  monthInterval: number
) {
  const start = toUtcDateOnly(rule.startDate);
  const ruleEnd = rule.endDate ? toUtcDateOnly(rule.endDate) : null;
  const periodStartDay = toUtcDateOnly(periodStart);
  const periodEndDay = toUtcDateOnly(periodEndExclusive);
  const preferredDay = rule.dayOfMonth ?? start.getUTCDate();
  const dates: Date[] = [];

  let cursor = createMonthDate(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    preferredDay
  );
  if (cursor < start) {
    cursor = addMonths(cursor, monthInterval, preferredDay);
  }

  for (
    let iteration = 0;
    iteration < MAX_OCCURRENCE_ITERATIONS && cursor < periodEndDay;
    iteration += 1
  ) {
    if (
      cursor >= periodStartDay &&
      cursor < periodEndDay &&
      (!ruleEnd || cursor <= ruleEnd)
    ) {
      dates.push(cursor);
    }

    cursor = addMonths(cursor, monthInterval, preferredDay);
  }

  return dates;
}

function toUtcDateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMonths(value: Date, months: number, preferredDay: number) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + months;

  return createMonthDate(year, month, preferredDay);
}

function createMonthDate(year: number, month: number, preferredDay: number) {
  const cappedDay = Math.min(preferredDay, daysInMonth(year, month));
  return new Date(Date.UTC(year, month, cappedDay));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
