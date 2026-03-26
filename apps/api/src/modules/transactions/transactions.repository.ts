import { Injectable } from '@nestjs/common';
import { TransactionOrigin, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRecentByUserId(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: { account: true, category: true },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
      take: 100
    });
  }

  createForUser(userId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        userId,
        title: dto.title,
        type: dto.type,
        amountWon: dto.amountWon,
        businessDate: new Date(dto.businessDate),
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        memo: dto.memo,
        origin: TransactionOrigin.MANUAL,
        status: TransactionStatus.POSTED
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
