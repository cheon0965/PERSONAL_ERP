import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  FinancialStatementsView
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { GenerateFinancialStatementsUseCase } from './generate-financial-statements.use-case';
import { GenerateFinancialStatementsRequestDto } from './dto/generate-financial-statements.dto';
import { FinancialStatementsService } from './financial-statements.service';

@ApiTags('financial-statements')
@ApiBearerAuth()
@Controller('financial-statements')
export class FinancialStatementsController {
  constructor(
    private readonly financialStatementsService: FinancialStatementsService,
    private readonly generateFinancialStatementsUseCase: GenerateFinancialStatementsUseCase
  ) {}

  @Get()
  findView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('periodId') periodId?: string
  ): Promise<FinancialStatementsView | null> {
    return this.financialStatementsService.findView(user, periodId);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenerateFinancialStatementsRequestDto
  ): Promise<FinancialStatementsView> {
    return this.generateFinancialStatementsUseCase.execute(user, body);
  }
}
