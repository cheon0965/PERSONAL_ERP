import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  FinancialStatementsView
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readAllowedWorkspaceRoles } from '../../common/auth/workspace-action.policy';
import { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { GenerateFinancialStatementsRequestDto } from './dto/generate-financial-statements.dto';
import { FinancialStatementsService } from './financial-statements.service';
import { GenerateFinancialStatementsUseCase } from './generate-financial-statements.use-case';

@ApiTags('financial-statements')
@ApiBearerAuth()
@Controller('financial-statements')
export class FinancialStatementsController {
  constructor(
    private readonly financialStatementsService: FinancialStatementsService,
    private readonly generateFinancialStatementsUseCase: GenerateFinancialStatementsUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('periodId') periodId?: string
  ): Promise<FinancialStatementsView | null> {
    return this.financialStatementsService.findView(user, periodId);
  }

  @Post('generate')
  async generate(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenerateFinancialStatementsRequestDto
  ): Promise<FinancialStatementsView> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const response = await this.generateFinancialStatementsUseCase.execute(
        user,
        body
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'financial_statement.generate',
        request,
        workspace,
        details: {
          periodId: response.period.id,
          snapshotCount: response.snapshots.length
        }
      });

      return response;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'financial_statement.generate',
          request,
          workspace,
          details: {
            periodId: body.periodId,
            requiredRoles: readAllowedWorkspaceRoles(
              'financial_statement.generate'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}
