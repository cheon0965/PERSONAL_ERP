import { Injectable } from '@nestjs/common';
import { TransactionOrigin, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  CreateCollectedTransactionRecord,
  StoredCollectedTransaction
} from '../../application/ports/collected-transaction-store.port';
import { CollectedTransactionStorePort } from '../../application/ports/collected-transaction-store.port';

@Injectable()
export class PrismaCollectedTransactionStoreAdapter
  implements CollectedTransactionStorePort
{
  constructor(private readonly prisma: PrismaService) {}

  findRecentByUserId(userId: string): Promise<StoredCollectedTransaction[]> {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: { account: true, category: true },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
      take: 100
    });
  }

  createForUser(
    record: CreateCollectedTransactionRecord
  ): Promise<StoredCollectedTransaction> {
    return this.prisma.transaction.create({
      data: {
        userId: record.userId,
        title: record.title,
        type: record.type,
        amountWon: record.amountWon,
        businessDate: record.businessDate,
        accountId: record.fundingAccountId,
        categoryId: record.categoryId,
        memo: record.memo,
        origin: TransactionOrigin.MANUAL,
        status: TransactionStatus.POSTED
      },
      include: { account: true, category: true }
    });
  }
}
