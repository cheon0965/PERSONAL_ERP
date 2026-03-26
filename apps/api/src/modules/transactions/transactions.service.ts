import { Injectable, NotFoundException } from '@nestjs/common';
import type { TransactionItem } from '@personal-erp/contracts';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { mapTransactionToItem } from './transactions.mapper';
import { TransactionsRepository } from './transactions.repository';

@Injectable()
export class TransactionsService {
  constructor(private readonly transactionsRepository: TransactionsRepository) {}

  async findAll(userId: string): Promise<TransactionItem[]> {
    const transactions = await this.transactionsRepository.findRecentByUserId(userId);
    return transactions.map(mapTransactionToItem);
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const [accountExists, categoryExists] = await Promise.all([
      this.transactionsRepository.accountExistsForUser(userId, dto.accountId),
      this.transactionsRepository.categoryExistsForUser(userId, dto.categoryId)
    ]);

    if (!accountExists) {
      throw new NotFoundException('Account not found');
    }

    if (!categoryExists) {
      throw new NotFoundException('Category not found');
    }

    return this.transactionsRepository.createForUser(userId, dto);
  }
}
