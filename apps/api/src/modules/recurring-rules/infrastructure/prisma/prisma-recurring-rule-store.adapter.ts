import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  CreateRecurringRuleRecord,
  StoredRecurringRule,
  StoredRecurringRuleDetail,
  UpdateRecurringRuleRecord
} from '../../application/ports/recurring-rule-store.port';
import { RecurringRuleStorePort } from '../../application/ports/recurring-rule-store.port';

@Injectable()
export class PrismaRecurringRuleStoreAdapter implements RecurringRuleStorePort {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(
    tenantId: string,
    ledgerId: string
  ): Promise<StoredRecurringRule[]> {
    return this.prisma.recurringRule.findMany({
      where: { tenantId, ledgerId },
      include: { account: true, category: true },
      orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }]
    });
  }

  findByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    recurringRuleId: string
  ): Promise<StoredRecurringRuleDetail | null> {
    return this.prisma.recurringRule.findFirst({
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
        isActive: true
      }
    });
  }

  createInWorkspace(
    record: CreateRecurringRuleRecord
  ): Promise<StoredRecurringRule> {
    return this.prisma.recurringRule.create({
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
      include: { account: true, category: true }
    });
  }

  updateInWorkspace(
    _tenantId: string,
    _ledgerId: string,
    record: UpdateRecurringRuleRecord
  ): Promise<StoredRecurringRule> {
    return this.prisma.recurringRule.update({
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
      include: { account: true, category: true }
    });
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