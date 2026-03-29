import { Module } from '@nestjs/common';
import { LedgerTransactionTypesController } from './ledger-transaction-types.controller';
import { LedgerTransactionTypesService } from './ledger-transaction-types.service';

@Module({
  controllers: [LedgerTransactionTypesController],
  providers: [LedgerTransactionTypesService]
})
export class LedgerTransactionTypesModule {}
