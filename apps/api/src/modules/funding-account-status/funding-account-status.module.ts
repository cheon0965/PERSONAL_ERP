import { Module } from '@nestjs/common';
import { FundingAccountStatusController } from './funding-account-status.controller';
import { FundingAccountStatusService } from './services/funding-account-status.service';

@Module({
  controllers: [FundingAccountStatusController],
  providers: [FundingAccountStatusService]
})
export class FundingAccountStatusModule {}
