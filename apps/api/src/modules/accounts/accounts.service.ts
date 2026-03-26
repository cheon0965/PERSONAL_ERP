import { Injectable } from '@nestjs/common';
import type { AccountItem } from '@personal-erp/contracts';
import { mapAccountToItem } from './accounts.mapper';
import { AccountsRepository } from './accounts.repository';

@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  async findAll(userId: string): Promise<AccountItem[]> {
    const accounts = await this.accountsRepository.findAllByUserId(userId);
    return accounts.map(mapAccountToItem);
  }
}
