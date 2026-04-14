import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Patch,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  assertWorkspaceActionAllowed,
  readAllowedWorkspaceRoles,
  type WorkspaceAction
} from '../../common/auth/workspace-action.policy';
import type { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto';
import { WorkspaceSettingsService } from './workspace-settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class WorkspaceSettingsController {
  constructor(
    private readonly workspaceSettingsService: WorkspaceSettingsService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get('workspace')
  @Header('Cache-Control', 'no-store')
  async getWorkspaceSettings(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'workspace_settings.read',
      request,
      workspace
    });

    const response = await this.workspaceSettingsService.getCurrent(workspace);
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'workspace_settings.read',
      request,
      workspace,
      details: {
        tenantId: response.tenant.id,
        ledgerId: response.ledger.id
      }
    });

    return response;
  }

  @Patch('workspace')
  @Header('Cache-Control', 'no-store')
  async updateWorkspaceSettings(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceSettingsDto
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'workspace_settings.update',
      request,
      workspace
    });

    const response = await this.workspaceSettingsService.update(
      workspace,
      request,
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'workspace_settings.update',
      request,
      workspace,
      persist: false,
      details: {
        tenantId: response.tenant.id,
        ledgerId: response.ledger.id
      }
    });

    return response;
  }

  private async assertAllowed(input: {
    action: WorkspaceAction;
    request: RequestWithContext;
    workspace: ReturnType<typeof requireCurrentWorkspace>;
  }): Promise<void> {
    try {
      assertWorkspaceActionAllowed(
        input.workspace.membershipRole,
        input.action
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: input.action,
          request: input.request,
          workspace: input.workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles(input.action).join(',')
          }
        });
      }

      throw error;
    }
  }
}
