import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  FundingAccountItem
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { mapFundingAccountRecordToItem } from './funding-account.mapper';
import { FundingAccountsRepository } from './funding-accounts.repository';

@Injectable()
export class FundingAccountsService {
  constructor(
    private readonly fundingAccountsRepository: FundingAccountsRepository
  ) {}

  async findAll(user: AuthenticatedUser): Promise<FundingAccountItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const accounts = await this.fundingAccountsRepository.findAllInWorkspace(
      workspace.tenantId,
      workspace.ledgerId
    );
    return accounts.map(mapFundingAccountRecordToItem);
  }
}
