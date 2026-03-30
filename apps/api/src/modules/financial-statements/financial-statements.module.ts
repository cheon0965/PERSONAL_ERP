import { Module } from '@nestjs/common';
import { GenerateFinancialStatementsUseCase } from './generate-financial-statements.use-case';
import { FinancialStatementsController } from './financial-statements.controller';
import { FinancialStatementsService } from './financial-statements.service';

@Module({
  controllers: [FinancialStatementsController],
  providers: [FinancialStatementsService, GenerateFinancialStatementsUseCase]
})
export class FinancialStatementsModule {}
