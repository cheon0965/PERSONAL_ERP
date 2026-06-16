import { Module } from '@nestjs/common';
import { AccountSubjectsController } from './account-subjects.controller';
import { AccountSubjectsService } from './services/account-subjects.service';

@Module({
  controllers: [AccountSubjectsController],
  providers: [AccountSubjectsService]
})
export class AccountSubjectsModule {}
