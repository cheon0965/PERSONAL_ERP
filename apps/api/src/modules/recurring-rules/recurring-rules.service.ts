import { Injectable, NotFoundException } from '@nestjs/common';
import type { RecurringRuleItem } from '@personal-erp/contracts';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { mapRecurringRuleToItem } from './recurring-rules.mapper';
import { RecurringRulesRepository } from './recurring-rules.repository';

@Injectable()
export class RecurringRulesService {
  constructor(private readonly recurringRulesRepository: RecurringRulesRepository) {}

  async findAll(userId: string): Promise<RecurringRuleItem[]> {
    const rules = await this.recurringRulesRepository.findAllByUserId(userId);
    return rules.map(mapRecurringRuleToItem);
  }

  async create(userId: string, dto: CreateRecurringRuleDto) {
    const [accountExists, categoryExists] = await Promise.all([
      this.recurringRulesRepository.accountExistsForUser(userId, dto.accountId),
      this.recurringRulesRepository.categoryExistsForUser(userId, dto.categoryId)
    ]);

    if (!accountExists) {
      throw new NotFoundException('Account not found');
    }

    if (!categoryExists) {
      throw new NotFoundException('Category not found');
    }

    return this.recurringRulesRepository.createForUser(userId, dto);
  }
}
