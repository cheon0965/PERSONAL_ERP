import { Module } from '@nestjs/common';
import { FinancialStatementGenerationPort } from './application/ports/financial-statement-generation.port';
import { GenerateFinancialStatementsUseCase } from './generate-financial-statements.use-case';
import { FinancialStatementsController } from './financial-statements.controller';
import { PrismaFinancialStatementGenerationAdapter } from './infrastructure/prisma/prisma-financial-statement-generation.adapter';
import { FinancialStatementsService } from './financial-statements.service';

@Module({
  controllers: [FinancialStatementsController],
  providers: [
    FinancialStatementsService,
    GenerateFinancialStatementsUseCase,
    PrismaFinancialStatementGenerationAdapter,
    {
      provide: FinancialStatementGenerationPort,
      useExisting: PrismaFinancialStatementGenerationAdapter
    }
  ]
})
export class FinancialStatementsModule {}
