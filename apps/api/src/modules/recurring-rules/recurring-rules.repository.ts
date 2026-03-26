import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';

@Injectable()
export class RecurringRulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUserId(userId: string) {
    return this.prisma.recurringRule.findMany({
      where: { userId },
      include: { account: true, category: true },
      orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }]
    });
  }

  createForUser(userId: string, dto: CreateRecurringRuleDto) {
    return this.prisma.recurringRule.create({
      data: {
        userId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        title: dto.title,
        amountWon: dto.amountWon,
        frequency: dto.frequency,
        dayOfMonth: dto.dayOfMonth,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isActive: dto.isActive ?? true,
        nextRunDate: new Date(dto.startDate)
      }
    });
  }

  async accountExistsForUser(userId: string, accountId: string): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true }
    });

    return Boolean(account);
  }

  async categoryExistsForUser(userId: string, categoryId?: string): Promise<boolean> {
    if (!categoryId) {
      return true;
    }

    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true }
    });

    return Boolean(category);
  }
}
