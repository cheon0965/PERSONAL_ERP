import {
  Body,
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
  Query,
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
import type { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { CreateInsurancePolicyDto } from './dto/create-insurance-policy.dto';
import { UpdateInsurancePolicyDto } from './dto/update-insurance-policy.dto';
import { CreateInsurancePolicyUseCase } from './application/use-cases/create-insurance-policy.use-case';
import { DeleteInsurancePolicyUseCase } from './application/use-cases/delete-insurance-policy.use-case';
import { UpdateInsurancePolicyUseCase } from './application/use-cases/update-insurance-policy.use-case';
import { InsurancePolicyQueryService } from './insurance-policy-query.service';

@ApiTags('insurance-policies')
@ApiBearerAuth()
@Controller('insurance-policies')
export class InsurancePoliciesController {
  constructor(
    private readonly insurancePolicyQueryService: InsurancePolicyQueryService,
    private readonly createInsurancePolicyUseCase: CreateInsurancePolicyUseCase,
    private readonly updateInsurancePolicyUseCase: UpdateInsurancePolicyUseCase,
    private readonly deleteInsurancePolicyUseCase: DeleteInsurancePolicyUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string
  ) {
    return this.insurancePolicyQueryService.findAll(user, {
      includeInactive: readBooleanQueryFlag(includeInactive)
    });
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInsurancePolicyDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'insurance_policy.create'
      );

      const created = await this.createInsurancePolicyUseCase.execute(
        user,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'insurance_policy.create',
        request,
        workspace,
        details: {
          insurancePolicyId: created.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'insurance_policy.create',
          request,
          workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles(
              'insurance_policy.create'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') insurancePolicyId: string
  ): Promise<void> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'insurance_policy.delete'
      );

      const deleted = await this.deleteInsurancePolicyUseCase.execute(
        user,
        insurancePolicyId
      );

      if (!deleted) {
        throw new NotFoundException('Insurance policy not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'insurance_policy.delete',
        request,
        workspace,
        details: {
          insurancePolicyId
        }
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'insurance_policy.delete',
          request,
          workspace,
          details: {
            insurancePolicyId,
            requiredRoles: readAllowedWorkspaceRoles(
              'insurance_policy.delete'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') insurancePolicyId: string,
    @Body() dto: UpdateInsurancePolicyDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'insurance_policy.update'
      );

      const updated = await this.updateInsurancePolicyUseCase.execute(
        user,
        insurancePolicyId,
        dto
      );

      if (!updated) {
        throw new NotFoundException('Insurance policy not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'insurance_policy.update',
        request,
        workspace,
        details: {
          insurancePolicyId: updated.id
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'insurance_policy.update',
          request,
          workspace,
          details: {
            insurancePolicyId,
            requiredRoles: readAllowedWorkspaceRoles(
              'insurance_policy.update'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}

function readBooleanQueryFlag(value?: string) {
  if (!value) {
    return false;
  }

  return value === 'true' || value === '1';
}
