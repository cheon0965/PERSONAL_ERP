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
import { FundingAccountsService } from './funding-accounts.service';
import { CreateFundingAccountDto } from './dto/create-funding-account.dto';
import { UpdateFundingAccountDto } from './dto/update-funding-account.dto';

@ApiTags('funding-accounts')
@ApiBearerAuth()
@Controller('funding-accounts')
export class FundingAccountsController {
  constructor(
    private readonly fundingAccountsService: FundingAccountsService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string
  ) {
    return this.fundingAccountsService.findAllWithOptions(user, {
      includeInactive: readBooleanQueryFlag(includeInactive)
    });
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFundingAccountDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'funding_account.create'
      );

      const created = await this.fundingAccountsService.create(user, dto);

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'funding_account.create',
        request,
        workspace,
        details: {
          fundingAccountId: created.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'funding_account.create',
          request,
          workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles(
              'funding_account.create'
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
    @Param('id') fundingAccountId: string,
    @Body() dto: UpdateFundingAccountDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'funding_account.update'
      );

      const updated = await this.fundingAccountsService.update(
        user,
        fundingAccountId,
        dto
      );

      if (!updated) {
        throw new NotFoundException('Funding account not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'funding_account.update',
        request,
        workspace,
        details: {
          fundingAccountId: updated.id
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'funding_account.update',
          request,
          workspace,
          details: {
            fundingAccountId,
            requiredRoles: readAllowedWorkspaceRoles(
              'funding_account.update'
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
    @Param('id') fundingAccountId: string
  ): Promise<void> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'funding_account.delete'
      );

      const deleted = await this.fundingAccountsService.delete(
        user,
        fundingAccountId
      );

      if (!deleted) {
        throw new NotFoundException('Funding account not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'funding_account.delete',
        request,
        workspace,
        details: {
          fundingAccountId
        }
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'funding_account.delete',
          request,
          workspace,
          details: {
            fundingAccountId,
            requiredRoles: readAllowedWorkspaceRoles(
              'funding_account.delete'
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
