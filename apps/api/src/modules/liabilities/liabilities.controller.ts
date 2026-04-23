import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  GenerateLiabilityPlanItemResponse,
  LiabilityAgreementItem,
  LiabilityOverviewResponse,
  LiabilityRepaymentScheduleItem
} from '@personal-erp/contracts';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  assertWorkspaceActionAllowed,
  readAllowedWorkspaceRoles
} from '../../common/auth/workspace-action.policy';
import type { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { CreateLiabilityAgreementDto } from './dto/create-liability-agreement.dto';
import { CreateLiabilityRepaymentScheduleDto } from './dto/create-liability-repayment-schedule.dto';
import { UpdateLiabilityAgreementDto } from './dto/update-liability-agreement.dto';
import { UpdateLiabilityRepaymentScheduleDto } from './dto/update-liability-repayment-schedule.dto';
import { LiabilitiesService } from './liabilities.service';

@ApiTags('liabilities')
@ApiBearerAuth()
@Controller('liabilities')
export class LiabilitiesController {
  constructor(
    private readonly liabilitiesService: LiabilitiesService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string
  ): Promise<LiabilityAgreementItem[]> {
    return this.liabilitiesService.findAll(user, {
      includeArchived: readBooleanQueryFlag(includeArchived)
    });
  }

  @Get('overview')
  findOverview(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<LiabilityOverviewResponse> {
    return this.liabilitiesService.findOverview(user);
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLiabilityAgreementDto
  ): Promise<LiabilityAgreementItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'liability_agreement.create'
      );

      const created = await this.liabilitiesService.createAgreement(user, dto);

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'liability_agreement.create',
        request,
        workspace,
        details: {
          liabilityAgreementId: created.id
        }
      });

      return created;
    } catch (error) {
      this.logDeniedIfForbidden(error, {
        action: 'liability_agreement.create',
        request,
        workspace
      });
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') liabilityAgreementId: string,
    @Body() dto: UpdateLiabilityAgreementDto
  ): Promise<LiabilityAgreementItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'liability_agreement.update'
      );

      const updated = await this.liabilitiesService.updateAgreement(
        user,
        liabilityAgreementId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'liability_agreement.update',
        request,
        workspace,
        details: {
          liabilityAgreementId: updated.id
        }
      });

      return updated;
    } catch (error) {
      this.logDeniedIfForbidden(error, {
        action: 'liability_agreement.update',
        request,
        workspace,
        details: { liabilityAgreementId }
      });
      throw error;
    }
  }

  @Post(':id/archive')
  async archive(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') liabilityAgreementId: string
  ): Promise<LiabilityAgreementItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'liability_agreement.archive'
      );

      const archived = await this.liabilitiesService.archiveAgreement(
        user,
        liabilityAgreementId
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'liability_agreement.archive',
        request,
        workspace,
        details: {
          liabilityAgreementId
        }
      });

      return archived;
    } catch (error) {
      this.logDeniedIfForbidden(error, {
        action: 'liability_agreement.archive',
        request,
        workspace,
        details: { liabilityAgreementId }
      });
      throw error;
    }
  }

  @Get(':id/repayments')
  findRepayments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') liabilityAgreementId: string
  ): Promise<LiabilityRepaymentScheduleItem[]> {
    return this.liabilitiesService.findRepayments(user, liabilityAgreementId);
  }

  @Post(':id/repayments')
  async createRepayment(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') liabilityAgreementId: string,
    @Body() dto: CreateLiabilityRepaymentScheduleDto
  ): Promise<LiabilityRepaymentScheduleItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'liability_repayment.create'
      );

      const created = await this.liabilitiesService.createRepayment(
        user,
        liabilityAgreementId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'liability_repayment.create',
        request,
        workspace,
        details: {
          liabilityAgreementId,
          liabilityRepaymentScheduleId: created.id
        }
      });

      return created;
    } catch (error) {
      this.logDeniedIfForbidden(error, {
        action: 'liability_repayment.create',
        request,
        workspace,
        details: { liabilityAgreementId }
      });
      throw error;
    }
  }

  @Patch(':id/repayments/:repaymentId')
  async updateRepayment(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') liabilityAgreementId: string,
    @Param('repaymentId') repaymentId: string,
    @Body() dto: UpdateLiabilityRepaymentScheduleDto
  ): Promise<LiabilityRepaymentScheduleItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'liability_repayment.update'
      );

      const updated = await this.liabilitiesService.updateRepayment(
        user,
        liabilityAgreementId,
        repaymentId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'liability_repayment.update',
        request,
        workspace,
        details: {
          liabilityAgreementId,
          liabilityRepaymentScheduleId: updated.id
        }
      });

      return updated;
    } catch (error) {
      this.logDeniedIfForbidden(error, {
        action: 'liability_repayment.update',
        request,
        workspace,
        details: { liabilityAgreementId, repaymentId }
      });
      throw error;
    }
  }

  @Post(':id/repayments/:repaymentId/generate-plan-item')
  async generatePlanItem(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') liabilityAgreementId: string,
    @Param('repaymentId') repaymentId: string
  ): Promise<GenerateLiabilityPlanItemResponse> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'liability_repayment.generate_plan_item'
      );

      const result = await this.liabilitiesService.generatePlanItem(
        user,
        liabilityAgreementId,
        repaymentId
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'liability_repayment.generate_plan_item',
        request,
        workspace,
        details: {
          liabilityAgreementId,
          liabilityRepaymentScheduleId: result.repayment.id,
          planItemId: result.createdPlanItemId,
          collectedTransactionId: result.createdCollectedTransactionId
        }
      });

      return result;
    } catch (error) {
      this.logDeniedIfForbidden(error, {
        action: 'liability_repayment.generate_plan_item',
        request,
        workspace,
        details: { liabilityAgreementId, repaymentId }
      });
      throw error;
    }
  }

  private logDeniedIfForbidden(
    error: unknown,
    input: {
      action:
        | 'liability_agreement.create'
        | 'liability_agreement.update'
        | 'liability_agreement.archive'
        | 'liability_repayment.create'
        | 'liability_repayment.update'
        | 'liability_repayment.generate_plan_item';
      request: RequestWithContext;
      workspace: ReturnType<typeof requireCurrentWorkspace>;
      details?: Record<string, string>;
    }
  ) {
    if (!(error instanceof ForbiddenException)) {
      return;
    }

    logWorkspaceActionDenied(this.securityEvents, {
      action: input.action,
      request: input.request,
      workspace: input.workspace,
      details: {
        ...(input.details ?? {}),
        requiredRoles: readAllowedWorkspaceRoles(input.action).join(',')
      }
    });
  }
}

function readBooleanQueryFlag(value?: string) {
  if (!value) {
    return false;
  }

  return value === 'true' || value === '1';
}
