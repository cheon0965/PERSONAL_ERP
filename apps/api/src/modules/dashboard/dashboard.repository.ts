import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type DashboardSummarySource = {
  minimumReserveWon: number | null;
  accounts: Array<{ balanceWon: number }>;
  transactions: Array<{ type: 'INCOME' | 'EXPENSE' | 'TRANSFER'; amountWon: number }>;
  recurringRules: Array<{ amountWon: number }>;
  insurancePolicies: Array<{ monthlyPremiumWon: number }>;
  vehicles: Array<{ monthlyExpenseWon: number }>;
};

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummarySource(userId: string): Promise<DashboardSummarySource> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        settings: {
          select: {
            minimumReserveWon: true
          }
        }
      }
    });

    const [accounts, transactions, recurringRules, insurancePolicies, vehicles] = await Promise.all([
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
      }),
      this.prisma.insurancePolicy.findMany({
        where: { userId, isActive: true },
        select: { monthlyPremiumWon: true }
      }),
      this.prisma.vehicle.findMany({
        where: { userId },
        select: { monthlyExpenseWon: true }
      })
    ]);

    return {
      minimumReserveWon: user.settings?.minimumReserveWon ?? null,
      accounts,
      transactions,
      recurringRules,
      insurancePolicies,
      vehicles
    };
  }
}
