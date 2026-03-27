import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type MonthlyForecastReadModel = {
  minimumReserveWon: number | null;
  monthlySinkingFundWon: number | null;
  accounts: Array<{ balanceWon: number }>;
  transactions: Array<{ type: 'INCOME' | 'EXPENSE' | 'TRANSFER'; amountWon: number }>;
  recurringRules: Array<{ amountWon: number }>;
};

@Injectable()
export class ForecastReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyForecastReadModel(
    userId: string
  ): Promise<MonthlyForecastReadModel> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        settings: {
          select: {
            minimumReserveWon: true,
            monthlySinkingFundWon: true
          }
        }
      }
    });

    const [accounts, transactions, recurringRules] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId },
        select: { balanceWon: true }
      }),
      this.prisma.transaction.findMany({
        where: { userId, status: TransactionStatus.POSTED },
        select: { type: true, amountWon: true }
      }),
      this.prisma.recurringRule.findMany({
        where: { userId, isActive: true },
        select: { amountWon: true }
      })
    ]);

    return {
      minimumReserveWon: user.settings?.minimumReserveWon ?? null,
      monthlySinkingFundWon: user.settings?.monthlySinkingFundWon ?? null,
      accounts,
      transactions,
      recurringRules
    };
  }
}
