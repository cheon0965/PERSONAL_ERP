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
  CarryForwardView
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
import { CarryForwardsService } from './carry-forwards.service';
import { GenerateCarryForwardRequestDto } from './dto/generate-carry-forward.dto';
import { GenerateCarryForwardUseCase } from './generate-carry-forward.use-case';

@ApiTags('carry-forwards')
@ApiBearerAuth()
@Controller('carry-forwards')
export class CarryForwardsController {
  constructor(
    private readonly carryForwardsService: CarryForwardsService,
    private readonly generateCarryForwardUseCase: GenerateCarryForwardUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fromPeriodId') fromPeriodId?: string
  ): Promise<CarryForwardView | null> {
    return this.carryForwardsService.findView(user, fromPeriodId);
  }

  @Post('generate')
  async generate(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenerateCarryForwardRequestDto
  ): Promise<CarryForwardView> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const response = await this.generateCarryForwardUseCase.execute(user, body);

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'carry_forward.generate',
        request,
        workspace,
        details: {
          fromPeriodId: response.sourcePeriod.id,
          toPeriodId: response.targetPeriod.id,
          carryForwardRecordId: response.carryForwardRecord.id
        }
      });

      return response;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'carry_forward.generate',
          request,
          workspace,
          details: {
            fromPeriodId: body.fromPeriodId,
            requiredRoles: readAllowedWorkspaceRoles(
              'carry_forward.generate'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}
