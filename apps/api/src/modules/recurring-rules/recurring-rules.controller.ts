import { Body, Controller, Get, NotFoundException, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { CreateRecurringRuleUseCase } from './application/use-cases/create-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from './application/use-cases/list-recurring-rules.use-case';
import { MissingOwnedRecurringRuleReferenceError } from './domain/recurring-rule-policy';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';

@ApiTags('recurring-rules')
@ApiBearerAuth()
@Controller('recurring-rules')
export class RecurringRulesController {
  constructor(
    private readonly listRecurringRulesUseCase: ListRecurringRulesUseCase,
    private readonly createRecurringRuleUseCase: CreateRecurringRuleUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    const workspace = requireCurrentWorkspace(user);

    return this.listRecurringRulesUseCase.execute({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    });
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringRuleDto
  ) {
    try {
      const workspace = requireCurrentWorkspace(user);

      return await this.createRecurringRuleUseCase.execute({
        userId: workspace.userId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        ...dto
      });
    } catch (error) {
      if (error instanceof MissingOwnedRecurringRuleReferenceError) {
        this.securityEvents.warn('authorization.scope_denied', {
          requestId: readRequestId(request),
          path: readRequestPath(request),
          userId: user.id,
          resource: `recurring_rule_${error.reference}`
        });
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }
}
