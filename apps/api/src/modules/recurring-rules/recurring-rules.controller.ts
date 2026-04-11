import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  assertWorkspaceActionAllowed,
  readAllowedWorkspaceRoles
} from '../../common/auth/workspace-action.policy';
import { requirePositiveMoneyWon } from '../../common/money/money-won';
import {
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { DeleteRecurringRuleUseCase } from './application/use-cases/delete-recurring-rule.use-case';
import { GetRecurringRuleDetailUseCase } from './application/use-cases/get-recurring-rule-detail.use-case';
import { CreateRecurringRuleUseCase } from './application/use-cases/create-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from './application/use-cases/list-recurring-rules.use-case';
import { UpdateRecurringRuleUseCase } from './application/use-cases/update-recurring-rule.use-case';
import {
  InsuranceManagedRecurringRuleError,
  MissingOwnedRecurringRuleReferenceError
} from './domain/recurring-rule-policy';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from './dto/update-recurring-rule.dto';

@ApiTags('recurring-rules')
@ApiBearerAuth()
@Controller('recurring-rules')
export class RecurringRulesController {
  constructor(
    private readonly listRecurringRulesUseCase: ListRecurringRulesUseCase,
    private readonly getRecurringRuleDetailUseCase: GetRecurringRuleDetailUseCase,
    private readonly createRecurringRuleUseCase: CreateRecurringRuleUseCase,
    private readonly updateRecurringRuleUseCase: UpdateRecurringRuleUseCase,
    private readonly deleteRecurringRuleUseCase: DeleteRecurringRuleUseCase,
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

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') recurringRuleId: string
  ) {
    const workspace = requireCurrentWorkspace(user);
    const rule = await this.getRecurringRuleDetailUseCase.execute({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      recurringRuleId
    });

    if (!rule) {
      throw new NotFoundException('Recurring rule not found');
    }

    return rule;
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringRuleDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'recurring_rule.create'
      );

      const created = await this.createRecurringRuleUseCase.execute({
        userId: workspace.userId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        ...dto,
        amountWon: requirePositiveMoneyWon(
          dto.amountWon,
          '반복 규칙 금액은 0보다 큰 안전한 정수여야 합니다.'
        )
      });

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'recurring_rule.create',
        request,
        workspace,
        details: {
          recurringRuleId: created.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'recurring_rule.create',
          request,
          workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles(
              'recurring_rule.create'
            ).join(',')
          }
        });
      }

      if (error instanceof MissingOwnedRecurringRuleReferenceError) {
        this.securityEvents.warn('authorization.scope_denied', {
          requestId: readRequestId(request),
          path: readRequestPath(request),
          userId: user.id,
          resource: `recurring_rule_${error.reference}`
        });
        throw new NotFoundException(error.message);
      }

      if (error instanceof InsuranceManagedRecurringRuleError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') recurringRuleId: string,
    @Body() dto: UpdateRecurringRuleDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'recurring_rule.update'
      );

      const updated = await this.updateRecurringRuleUseCase.execute({
        recurringRuleId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        ...dto,
        amountWon: requirePositiveMoneyWon(
          dto.amountWon,
          '반복 규칙 금액은 0보다 큰 안전한 정수여야 합니다.'
        )
      });

      if (!updated) {
        throw new NotFoundException('Recurring rule not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'recurring_rule.update',
        request,
        workspace,
        details: {
          recurringRuleId: updated.id
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'recurring_rule.update',
          request,
          workspace,
          details: {
            recurringRuleId,
            requiredRoles: readAllowedWorkspaceRoles(
              'recurring_rule.update'
            ).join(',')
          }
        });
      }

      if (error instanceof MissingOwnedRecurringRuleReferenceError) {
        this.securityEvents.warn('authorization.scope_denied', {
          requestId: readRequestId(request),
          path: readRequestPath(request),
          userId: user.id,
          resource: `recurring_rule_${error.reference}`
        });
        throw new NotFoundException(error.message);
      }

      if (error instanceof InsuranceManagedRecurringRuleError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') recurringRuleId: string
  ): Promise<void> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'recurring_rule.delete'
      );

      const deleted = await this.deleteRecurringRuleUseCase.execute({
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        recurringRuleId
      });

      if (!deleted) {
        throw new NotFoundException('Recurring rule not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'recurring_rule.delete',
        request,
        workspace,
        details: {
          recurringRuleId
        }
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'recurring_rule.delete',
          request,
          workspace,
          details: {
            recurringRuleId,
            requiredRoles: readAllowedWorkspaceRoles(
              'recurring_rule.delete'
            ).join(',')
          }
        });
      }

      if (error instanceof InsuranceManagedRecurringRuleError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }
}
