import { Injectable } from '@nestjs/common';
import type { RecurrenceFrequency } from '@personal-erp/contracts';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  CreateRecurringRuleRecord,
  StoredRecurringRule,
  StoredRecurringRuleDetail,
  UpdateRecurringRuleRecord
} from '../../application/ports/recurring-rule-store.port';
import { RecurringRuleStorePort } from '../../application/ports/recurring-rule-store.port';

type RecurringRuleListRecord = {
  id: string;
  title: string;
  amountWon: number;
  frequency: RecurrenceFrequency;
  nextRunDate: Date | null;
  isActive: boolean;
  account: {
    name: string;
  };
  category: {
    name: string;
  } | null;
  linkedInsurancePolicy: {
    id: string;
  } | null;
};

type RecurringRuleDetailRecord = {
  id: string;
  title: string;
  accountId: string;
  categoryId: string | null;
  amountWon: number;
  frequency: RecurrenceFrequency;
  dayOfMonth: number | null;
  startDate: Date;
  endDate: Date | null;
  nextRunDate: Date | null;
  isActive: boolean;
  linkedInsurancePolicy: {
    id: string;
  } | null;
};

@Injectable()
export class PrismaRecurringRuleStoreAdapter implements RecurringRuleStorePort {
  constructor(private readonly prisma: PrismaService) {}

  async findAllInWorkspace(
    tenantId: string,
    ledgerId: string
  ): Promise<StoredRecurringRule[]> {
    const items = await this.prisma.recurringRule.findMany({
      where: { tenantId, ledgerId },
      include: {
        account: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            name: true
          }
        },
        linkedInsurancePolicy: {
          select: {
            id: true
          }
        }
      },
      orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }]
    });

    return items.map(mapRecurringRuleListRecord);
  }

  async findByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    recurringRuleId: string
  ): Promise<StoredRecurringRuleDetail | null> {
    const item = await this.prisma.recurringRule.findFirst({
      where: {
        id: recurringRuleId,
        tenantId,
        ledgerId
      },
      select: {
        id: true,
        title: true,
        accountId: true,
        categoryId: true,
        amountWon: true,
        frequency: true,
        dayOfMonth: true,
        startDate: true,
        endDate: true,
        nextRunDate: true,
        isActive: true,
        linkedInsurancePolicy: {
          select: {
            id: true
          }
        }
      }
    });

    return item ? mapRecurringRuleDetailRecord(item) : null;
  }

  async createInWorkspace(
    record: CreateRecurringRuleRecord
  ): Promise<StoredRecurringRule> {
    const created = await this.prisma.recurringRule.create({
      data: {
        userId: record.userId,
        tenantId: record.tenantId,
        ledgerId: record.ledgerId,
        accountId: record.accountId,
        categoryId: record.categoryId,
        title: record.title,
        amountWon: record.amountWon,
        frequency: record.frequency,
        dayOfMonth: record.dayOfMonth,
        startDate: record.startDate,
        endDate: record.endDate,
        isActive: record.isActive,
        nextRunDate: record.nextRunDate
      },
      include: {
        account: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            name: true
          }
        },
        linkedInsurancePolicy: {
          select: {
            id: true
          }
        }
      }
    });

    return mapRecurringRuleListRecord(created);
  }

  async updateInWorkspace(
    _tenantId: string,
    _ledgerId: string,
    record: UpdateRecurringRuleRecord
  ): Promise<StoredRecurringRule> {
    const updated = await this.prisma.recurringRule.update({
      where: { id: record.id },
      data: {
        accountId: record.accountId,
        categoryId: record.categoryId,
        title: record.title,
        amountWon: record.amountWon,
        frequency: record.frequency,
        dayOfMonth: record.dayOfMonth,
        startDate: record.startDate,
        endDate: record.endDate,
        isActive: record.isActive,
        nextRunDate: record.nextRunDate
      },
      include: {
        account: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            name: true
          }
        },
        linkedInsurancePolicy: {
          select: {
            id: true
          }
        }
      }
    });

    return mapRecurringRuleListRecord(updated);
  }

  async deleteInWorkspace(
    tenantId: string,
    ledgerId: string,
    recurringRuleId: string
  ): Promise<boolean> {
    const result = await this.prisma.recurringRule.deleteMany({
      where: {
        id: recurringRuleId,
        tenantId,
        ledgerId
      }
    });

    return result.count > 0;
  }
}

function mapRecurringRuleListRecord(
  record: RecurringRuleListRecord
): StoredRecurringRule {
  return {
    id: record.id,
    title: record.title,
    amountWon: record.amountWon,
    frequency: record.frequency,
    nextRunDate: record.nextRunDate,
    isActive: record.isActive,
    linkedInsurancePolicyId: record.linkedInsurancePolicy?.id ?? null,
    account: {
      name: record.account.name
    },
    category: record.category
      ? {
          name: record.category.name
        }
      : null
  };
}

function mapRecurringRuleDetailRecord(
  record: RecurringRuleDetailRecord
): StoredRecurringRuleDetail {
  return {
    id: record.id,
    title: record.title,
    accountId: record.accountId,
    categoryId: record.categoryId,
    amountWon: record.amountWon,
    frequency: record.frequency,
    dayOfMonth: record.dayOfMonth,
    startDate: record.startDate,
    endDate: record.endDate,
    nextRunDate: record.nextRunDate,
    isActive: record.isActive,
    linkedInsurancePolicyId: record.linkedInsurancePolicy?.id ?? null
  };
}
