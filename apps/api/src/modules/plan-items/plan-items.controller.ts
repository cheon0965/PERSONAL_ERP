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
  GeneratePlanItemsResponse,
  PlanItemsView
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
import { GeneratePlanItemsRequestDto } from './dto/generate-plan-items.dto';
import { GeneratePlanItemsUseCase } from './generate-plan-items.use-case';
import { PlanItemsService } from './plan-items.service';

@ApiTags('plan-items')
@ApiBearerAuth()
@Controller('plan-items')
export class PlanItemsController {
  constructor(
    private readonly planItemsService: PlanItemsService,
    private readonly generatePlanItemsUseCase: GeneratePlanItemsUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('periodId') periodId?: string
  ): Promise<PlanItemsView | null> {
    return this.planItemsService.findView(user, periodId);
  }

  @Post('generate')
  async generate(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GeneratePlanItemsRequestDto
  ): Promise<GeneratePlanItemsResponse> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const response = await this.generatePlanItemsUseCase.execute(user, body);

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'plan_item.generate',
        request,
        workspace,
        details: {
          periodId: response.period.id,
          createdCount: response.generation.createdCount,
          skippedExistingCount: response.generation.skippedExistingCount,
          excludedRuleCount: response.generation.excludedRuleCount
        }
      });

      return response;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'plan_item.generate',
          request,
          workspace,
          details: {
            periodId: body.periodId,
            requiredRoles: readAllowedWorkspaceRoles('plan_item.generate').join(
              ','
            )
          }
        });
      }

      throw error;
    }
  }
}
