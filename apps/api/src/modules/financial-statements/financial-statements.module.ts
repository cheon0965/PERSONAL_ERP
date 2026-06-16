import { Module } from '@nestjs/common';
import { FinancialStatementGenerationPort } from './application/ports/financial-statement-generation.port';
import { FinancialStatementViewPort } from './application/ports/financial-statement-view.port';
import { GenerateFinancialStatementsUseCase } from './application/use-cases/generate-financial-statements.use-case';
import { FinancialStatementsController } from './financial-statements.controller';
import { PrismaFinancialStatementGenerationAdapter } from './infrastructure/prisma/prisma-financial-statement-generation.adapter';
import { FinancialStatementsService } from './infrastructure/services/financial-statements.service';

@Module({
  controllers: [FinancialStatementsController],
  providers: [
    FinancialStatementsService,
    GenerateFinancialStatementsUseCase,
    PrismaFinancialStatementGenerationAdapter,
    {
      provide: FinancialStatementGenerationPort,
      useExisting: PrismaFinancialStatementGenerationAdapter
    },
    {
      provide: FinancialStatementViewPort,
      useExisting: FinancialStatementsService
    }
  ]
})
export class FinancialStatementsModule {}
