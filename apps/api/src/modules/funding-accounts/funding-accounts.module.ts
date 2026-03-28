import { Module } from '@nestjs/common';
import { FundingAccountsController } from './funding-accounts.controller';
import { FundingAccountsRepository } from './funding-accounts.repository';
import { FundingAccountsService } from './funding-accounts.service';

@Module({
  controllers: [FundingAccountsController],
  providers: [FundingAccountsService, FundingAccountsRepository]
})
export class FundingAccountsModule {}
