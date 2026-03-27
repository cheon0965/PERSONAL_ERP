import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  CreateRecurringRuleRecord,
  StoredRecurringRule
} from '../../application/ports/recurring-rule-store.port';
import { RecurringRuleStorePort } from '../../application/ports/recurring-rule-store.port';

@Injectable()
export class PrismaRecurringRuleStoreAdapter implements RecurringRuleStorePort {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUserId(userId: string): Promise<StoredRecurringRule[]> {
    return this.prisma.recurringRule.findMany({
      where: { userId },
      include: { account: true, category: true },
      orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }]
    });
  }

  createForUser(
    record: CreateRecurringRuleRecord
  ): Promise<StoredRecurringRule> {
    return this.prisma.recurringRule.create({
      data: {
        userId: record.userId,
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
}
