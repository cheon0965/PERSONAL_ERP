import { Injectable } from '@nestjs/common';
import { TransactionOrigin, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  CreateTransactionRecord,
  StoredTransaction
} from '../../application/ports/transaction-store.port';
import { TransactionStorePort } from '../../application/ports/transaction-store.port';

@Injectable()
export class PrismaTransactionStoreAdapter implements TransactionStorePort {
  constructor(private readonly prisma: PrismaService) {}

  findRecentByUserId(userId: string): Promise<StoredTransaction[]> {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: { account: true, category: true },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
      take: 100
    });
  }

  createForUser(record: CreateTransactionRecord): Promise<StoredTransaction> {
    return this.prisma.transaction.create({
      data: {
        userId: record.userId,
        title: record.title,
        type: record.type,
        amountWon: record.amountWon,
        businessDate: record.businessDate,
        accountId: record.accountId,
        categoryId: record.categoryId,
        memo: record.memo,
        origin: TransactionOrigin.MANUAL,
        status: TransactionStatus.POSTED
      },
      include: { account: true, category: true }
    });
  }
}
