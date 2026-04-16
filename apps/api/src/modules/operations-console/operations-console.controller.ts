import { Body, Controller, ForbiddenException, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  OperationsExportResult,
  OperationsExportsResponse,
  OperationsChecklistResponse,
  OperationsExceptionsResponse,
  OperationsAlertsResponse,
  OperationsHubSummary,
  OperationsImportStatusSummary,
  OperationsMonthEndSummary,
  OperationsNoteItem,
  OperationsNotesResponse,
  OperationsSystemStatusSummary
} from '@personal-erp/contracts';
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
import { CreateOperationsExportDto } from './dto/create-operations-export.dto';
import { CreateOperationsNoteDto } from './dto/create-operations-note.dto';
import { OperationsConsoleCommandService } from './operations-console-command.service';
import { OperationsConsoleService } from './operations-console.service';

@ApiTags('operations')
@ApiBearerAuth()
@Controller('operations')
export class OperationsConsoleController {
  constructor(
    private readonly operationsConsoleService: OperationsConsoleService,
    private readonly operationsConsoleCommandService: OperationsConsoleCommandService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get('summary')
  getSummary(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsHubSummary> {
    this.assertReadable(user);
    return this.operationsConsoleService.getHubSummary(user);
  }

  @Get('checklist')
  getChecklist(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsChecklistResponse> {
    this.assertReadable(user);
    return this.operationsConsoleService.getChecklist(user);
  }

  @Get('exceptions')
  getExceptions(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsExceptionsResponse> {
    this.assertReadable(user);
    return this.operationsConsoleService.getExceptions(user);
  }

  @Get('month-end')
  getMonthEndSummary(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsMonthEndSummary> {
    this.assertReadable(user);
    return this.operationsConsoleService.getMonthEndSummary(user);
  }

  @Get('import-status')
  getImportStatus(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsImportStatusSummary> {
    this.assertReadable(user);
    return this.operationsConsoleService.getImportStatus(user);
  }

  @Get('system-status')
  getSystemStatus(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsSystemStatusSummary> {
    this.assertReadable(user);
    return this.operationsConsoleService.getSystemStatus(user);
  }

  @Get('alerts')
  getAlerts(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsAlertsResponse> {
    this.assertReadable(user);
    return this.operationsConsoleService.getAlerts(user);
  }

  @Get('exports')
  getExports(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsExportsResponse> {
    this.assertReadable(user);
    return this.operationsConsoleCommandService.getExports(user);
  }

  @Post('exports')
  async runExport(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOperationsExportDto
  ): Promise<OperationsExportResult> {
    const workspace = requireCurrentWorkspace(user);
    this.assertAllowed({
      action: 'operations_export.run',
      request,
      workspace
    });

    const response = await this.operationsConsoleCommandService.runExport(
      user,
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'operations_export.run',
      request,
      workspace,
      details: {
        resourceType: 'operations_export',
        resourceId: response.scope,
        scope: response.scope,
        rowCount: response.rowCount
      }
    });

    return response;
  }

  @Get('notes')
  getNotes(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OperationsNotesResponse> {
    this.assertReadable(user);
    return this.operationsConsoleCommandService.getNotes(user);
  }

  @Post('notes')
  async createNote(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOperationsNoteDto
  ): Promise<OperationsNoteItem> {
    const workspace = requireCurrentWorkspace(user);
    this.assertAllowed({
      action: 'operations_note.create',
      request,
      workspace
    });

    const response = await this.operationsConsoleCommandService.createNote(
      user,
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'operations_note.create',
      request,
      workspace,
      details: {
        resourceType: 'workspace_operational_note',
        resourceId: response.id,
        kind: response.kind,
        periodId: response.periodId
      }
    });

    return response;
  }

  private assertReadable(user: AuthenticatedUser): void {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'operations_console.read'
    );
  }

  private assertAllowed(input: {
    action: WorkspaceAction;
    request: RequestWithContext;
    workspace: ReturnType<typeof requireCurrentWorkspace>;
  }): void {
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
