import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Delete,
  Query,
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
import { AdminAuditEventsService } from './admin-audit-events.service';
import { AdminMemberQueryService } from './admin-member-query.service';
import { AdminPolicyService } from './admin-policy.service';
import { NavigationService } from '../navigation/public';
import { InviteTenantMemberUseCase } from './application/use-cases/invite-tenant-member.use-case';
import { RemoveTenantMemberUseCase } from './application/use-cases/remove-tenant-member.use-case';
import { UpdateTenantMemberRoleUseCase } from './application/use-cases/update-tenant-member-role.use-case';
import { UpdateTenantMemberStatusUseCase } from './application/use-cases/update-tenant-member-status.use-case';
import { AdminAuditEventsQueryDto } from './dto/admin-audit-events-query.dto';
import { InviteTenantMemberDto } from './dto/invite-tenant-member.dto';
import { UpdateNavigationMenuItemDto } from '../navigation/dto/update-navigation-menu-item.dto';
import { UpdateTenantMemberRoleDto } from './dto/update-tenant-member-role.dto';
import { UpdateTenantMemberStatusDto } from './dto/update-tenant-member-status.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly memberQueryService: AdminMemberQueryService,
    private readonly inviteTenantMemberUseCase: InviteTenantMemberUseCase,
    private readonly updateTenantMemberRoleUseCase: UpdateTenantMemberRoleUseCase,
    private readonly updateTenantMemberStatusUseCase: UpdateTenantMemberStatusUseCase,
    private readonly removeTenantMemberUseCase: RemoveTenantMemberUseCase,
    private readonly auditEventsService: AdminAuditEventsService,
    private readonly policyService: AdminPolicyService,
    private readonly navigationService: NavigationService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get('members')
  async findMembers(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_member.read',
      request,
      workspace
    });

    const members = await this.memberQueryService.findAll(workspace);
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_member.read',
      request,
      workspace,
      details: {
        memberCount: members.length
      }
    });

    return members;
  }

  @Post('members/invitations')
  async inviteMember(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteTenantMemberDto
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_member.invite',
      request,
      workspace
    });

    const invitation = await this.inviteTenantMemberUseCase.execute(
      workspace,
      request,
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_member.invite',
      request,
      workspace,
      persist: false,
      details: {
        invitationId: invitation.id,
        role: invitation.role
      }
    });

    return invitation;
  }

  @Patch('members/:membershipId/role')
  async updateMemberRole(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateTenantMemberRoleDto
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_member.update_role',
      request,
      workspace,
      resourceId: membershipId
    });

    const updated = await this.updateTenantMemberRoleUseCase.execute(
      workspace,
      request,
      membershipId,
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_member.update_role',
      request,
      workspace,
      persist: false,
      details: {
        membershipId: updated.id,
        role: updated.role
      }
    });

    return updated;
  }

  @Patch('members/:membershipId/status')
  async updateMemberStatus(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateTenantMemberStatusDto
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_member.update_status',
      request,
      workspace,
      resourceId: membershipId
    });

    const updated = await this.updateTenantMemberStatusUseCase.execute(
      workspace,
      request,
      membershipId,
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_member.update_status',
      request,
      workspace,
      persist: false,
      details: {
        membershipId: updated.id,
        status: updated.status
      }
    });

    return updated;
  }

  @Delete('members/:membershipId')
  @HttpCode(204)
  async removeMember(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_member.remove',
      request,
      workspace,
      resourceId: membershipId
    });

    await this.removeTenantMemberUseCase.execute(
      workspace,
      request,
      membershipId
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_member.remove',
      request,
      workspace,
      persist: false,
      details: {
        membershipId
      }
    });
  }

  @Get('audit-events')
  async findAuditEvents(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminAuditEventsQueryDto
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_audit_log.read',
      request,
      workspace
    });

    const response = await this.auditEventsService.findAll(workspace, query);
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_audit_log.read',
      request,
      workspace,
      details: {
        eventCount: response.items.length,
        offset: response.offset,
        limit: response.limit
      }
    });

    return response;
  }

  @Get('policy')
  async getPolicySummary(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_policy.read',
      request,
      workspace
    });

    const summary = await this.policyService.getSummary(workspace);
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_policy.read',
      request,
      workspace,
      details: {
        itemCount: summary.items.length
      }
    });

    return summary;
  }

  @Get('navigation')
  async getNavigation(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_navigation.read',
      request,
      workspace
    });

    const tree = await this.navigationService.getManagementTree(workspace);
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_navigation.read',
      request,
      workspace,
      details: {
        itemCount: countNavigationItems(tree.items)
      }
    });

    return tree;
  }

  @Patch('navigation/:menuItemId')
  async updateNavigationItem(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: UpdateNavigationMenuItemDto
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_navigation.update',
      request,
      workspace,
      resourceId: menuItemId
    });

    const tree = await this.navigationService.updateMenuItem(
      workspace,
      menuItemId,
      dto
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_navigation.update',
      request,
      workspace,
      persist: false,
      details: {
        menuItemId,
        isVisible: dto.isVisible,
        allowedRoles: dto.allowedRoles?.join(',')
      }
    });

    return tree;
  }

  @Get('audit-events/:auditEventId')
  async findAuditEvent(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('auditEventId') auditEventId: string
  ) {
    const workspace = requireCurrentWorkspace(user);
    await this.assertAllowed({
      action: 'admin_audit_log.read',
      request,
      workspace,
      resourceId: auditEventId
    });

    const event = await this.auditEventsService.findOne(
      workspace,
      auditEventId
    );
    logWorkspaceActionSucceeded(this.securityEvents, {
      action: 'admin_audit_log.read',
      request,
      workspace,
      details: {
        auditEventId
      }
    });

    return event;
  }

  private async assertAllowed(input: {
    action: WorkspaceAction;
    request: RequestWithContext;
    workspace: ReturnType<typeof requireCurrentWorkspace>;
    resourceId?: string;
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
            resourceId: input.resourceId,
            requiredRoles: readAllowedWorkspaceRoles(input.action).join(',')
          }
        });
      }

      throw error;
    }
  }
}

function countNavigationItems(items: Array<{ children: unknown[] }>): number {
  return items.reduce(
    (count, item) =>
      count +
      1 +
      countNavigationItems(item.children as Array<{ children: unknown[] }>),
    0
  );
}
