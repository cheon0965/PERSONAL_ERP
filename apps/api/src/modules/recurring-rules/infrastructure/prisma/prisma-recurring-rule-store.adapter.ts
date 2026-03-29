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
}
