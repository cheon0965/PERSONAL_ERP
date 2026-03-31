import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CloseAccountingPeriodResponse
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
import { CloseAccountingPeriodUseCase } from './close-accounting-period.use-case';
import { AccountingPeriodsService } from './accounting-periods.service';
import { CloseAccountingPeriodRequestDto } from './dto/close-accounting-period.dto';
import { OpenAccountingPeriodRequestDto } from './dto/open-accounting-period.dto';
import { ReopenAccountingPeriodRequestDto } from './dto/reopen-accounting-period.dto';
import { OpenAccountingPeriodUseCase } from './open-accounting-period.use-case';
import { ReopenAccountingPeriodUseCase } from './reopen-accounting-period.use-case';

@ApiTags('accounting-periods')
@ApiBearerAuth()
@Controller('accounting-periods')
export class AccountingPeriodsController {
  constructor(
    private readonly accountingPeriodsService: AccountingPeriodsService,
    private readonly openAccountingPeriodUseCase: OpenAccountingPeriodUseCase,
    private readonly closeAccountingPeriodUseCase: CloseAccountingPeriodUseCase,
    private readonly reopenAccountingPeriodUseCase: ReopenAccountingPeriodUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<AccountingPeriodItem[]> {
    return this.accountingPeriodsService.findAll(user);
  }

  @Get('current')
  findCurrent(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<AccountingPeriodItem | null> {
    return this.accountingPeriodsService.findCurrent(user);
  }

  @Post()
  async open(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OpenAccountingPeriodRequestDto
  ): Promise<AccountingPeriodItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const period = await this.openAccountingPeriodUseCase.execute(user, dto);

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'accounting_period.open',
        request,
        workspace,
        details: {
          periodId: period.id,
          periodMonth: period.monthLabel
        }
      });

      return period;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'accounting_period.open',
          request,
          workspace,
          details: {
            periodMonth: dto.month,
            requiredRoles: readAllowedWorkspaceRoles(
              'accounting_period.open'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Post(':id/close')
  async close(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') periodId: string,
    @Body() dto: CloseAccountingPeriodRequestDto
  ): Promise<CloseAccountingPeriodResponse> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const response = await this.closeAccountingPeriodUseCase.execute(
        user,
        periodId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'accounting_period.close',
        request,
        workspace,
        details: {
          periodId,
          closingSnapshotId: response.closingSnapshot.id
        }
      });

      return response;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'accounting_period.close',
          request,
          workspace,
          details: {
            periodId,
            requiredRoles: readAllowedWorkspaceRoles(
              'accounting_period.close'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Post(':id/reopen')
  async reopen(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') periodId: string,
    @Body() dto: ReopenAccountingPeriodRequestDto
  ): Promise<AccountingPeriodItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const period = await this.reopenAccountingPeriodUseCase.execute(
        user,
        periodId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'accounting_period.reopen',
        request,
        workspace,
        details: {
          periodId: period.id,
          periodMonth: period.monthLabel,
          reason: dto.reason
        }
      });

      return period;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'accounting_period.reopen',
          request,
          workspace,
          details: {
            periodId,
            requiredRoles: readAllowedWorkspaceRoles(
              'accounting_period.reopen'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}
