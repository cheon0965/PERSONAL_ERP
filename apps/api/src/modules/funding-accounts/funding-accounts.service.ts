import { Injectable } from '@nestjs/common';
import type { FundingAccountItem } from '@personal-erp/contracts';
import { mapFundingAccountRecordToItem } from './funding-account.mapper';
import { FundingAccountsRepository } from './funding-accounts.repository';

@Injectable()
export class FundingAccountsService {
  constructor(
    private readonly fundingAccountsRepository: FundingAccountsRepository
  ) {}

  async findAll(userId: string): Promise<FundingAccountItem[]> {
    const accounts = await this.fundingAccountsRepository.findAllByUserId(userId);
    return accounts.map(mapFundingAccountRecordToItem);
  }
}
