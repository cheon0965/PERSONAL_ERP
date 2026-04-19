import {
  Body,
  BadRequestException,
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
import { CurrentSessionId } from '../../common/auth/current-session-id.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  assertWorkspaceActionAllowed,
  readAllowedWorkspaceRoles,
  type WorkspaceAction
} from '../../common/auth/workspace-action.policy';
import type { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import {
  readRequestId,
  readRequestPath
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { AdminAuditEventsService } from './admin-audit-events.service';
import { AdminMemberQueryService } from './admin-member-query.service';
import { AdminPolicyService } from './admin-policy.service';
import { AdminSecurityThreatEventsService } from './admin-security-threat-events.service';
import { AdminSystemService } from './admin-system.service';
import { NavigationService } from '../navigation/public';
import { InviteTenantMemberUseCase } from './application/use-cases/invite-tenant-member.use-case';
import { RemoveTenantMemberUseCase } from './application/use-cases/remove-tenant-member.use-case';
import { UpdateTenantMemberRoleUseCase } from './application/use-cases/update-tenant-member-role.use-case';
import { UpdateTenantMemberStatusUseCase } from './application/use-cases/update-tenant-member-status.use-case';
import { AdminAuditEventsQueryDto } from './dto/admin-audit-events-query.dto';
import { AdminSecurityThreatEventsQueryDto } from './dto/admin-security-threat-events-query.dto';
import { InviteTenantMemberDto } from './dto/invite-tenant-member.dto';
import { UpdateNavigationMenuItemDto } from '../navigation/public';
import { UpdateAdminSupportContextDto } from './dto/update-admin-support-context.dto';
import { UpdateAdminTenantStatusDto } from './dto/update-admin-tenant-status.dto';
import { UpdateAdminUserEmailVerificationDto } from './dto/update-admin-user-email-verification.dto';
import { UpdateAdminUserStatusDto } from './dto/update-admin-user-status.dto';
import { UpdateAdminUserSystemAdminDto } from './dto/update-admin-user-system-admin.dto';
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
    private readonly securityThreatEventsService: AdminSecurityThreatEventsService,
    private readonly policyService: AdminPolicyService,
    private readonly systemService: AdminSystemService,
    private readonly navigationService: NavigationService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get('tenants')
  async findTenants(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.systemService.assertSystemAdmin(user);
    const tenants = await this.systemService.findTenants();
    this.logSystemAdminAction('admin_system.tenants.read', request, user, {
      tenantCount: tenants.length
    });
    return tenants;
  }

  @Get('tenants/:tenantId')
  async findTenant(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') tenantId: string
  ) {
    this.systemService.assertSystemAdmin(user);
    const tenant = await this.systemService.findTenantDetail(tenantId);
    this.logSystemAdminAction('admin_system.tenant.read', request, user, {
      tenantId
    });
    return tenant;
  }

  @Patch('tenants/:tenantId/status')
  async updateTenantStatus(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateAdminTenantStatusDto
  ) {
    this.systemService.assertSystemAdmin(user);
    const tenant = await this.systemService.updateTenantStatus(tenantId, dto);
    this.logSystemAdminAction('admin_system.tenant_status.update', request, user, {
      tenantId,
      status: dto.status
    });
    return tenant;
  }

  @Get('users')
  async findUsers(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.systemService.assertSystemAdmin(user);
    const users = await this.systemService.findUsers();
    this.logSystemAdminAction('admin_system.users.read', request, user, {
      userCount: users.length
    });
    return users;
  }

  @Get('users/:userId')
  async findUser(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string
  ) {
    this.systemService.assertSystemAdmin(user);
    const detail = await this.systemService.findUserDetail(userId);
    this.logSystemAdminAction('admin_system.user.read', request, user, {
      targetUserId: userId
    });
    return detail;
  }

  @Patch('users/:userId/status')
  async updateUserStatus(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserStatusDto
  ) {
    this.systemService.assertSystemAdmin(user);
    const detail = await this.systemService.updateUserStatus(user, userId, dto);
    this.logSystemAdminAction('admin_system.user_status.update', request, user, {
      targetUserId: userId,
      status: dto.status
    });
    return detail;
  }

  @Post('users/:userId/revoke-sessions')
  async revokeUserSessions(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string | undefined,
    @Param('userId') userId: string
  ) {
    this.systemService.assertSystemAdmin(user);
    const response = await this.systemService.revokeUserSessions(
      user,
      userId,
      currentSessionId
    );
    this.logSystemAdminAction('admin_system.user_sessions.revoke', request, user, {
      targetUserId: userId,
      revokedCount: response.revokedCount
    });
    return response;
  }

  @Patch('users/:userId/system-admin')
  async updateUserSystemAdmin(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserSystemAdminDto
  ) {
    this.systemService.assertSystemAdmin(user);
    const detail = await this.systemService.updateUserSystemAdmin(
      user,
      userId,
      dto
    );
    this.logSystemAdminAction('admin_system.user_system_admin.update', request, user, {
      targetUserId: userId,
      isSystemAdmin: dto.isSystemAdmin
    });
    return detail;
  }

  @Patch('users/:userId/email-verification')
  async updateUserEmailVerification(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserEmailVerificationDto
  ) {
    this.systemService.assertSystemAdmin(user);
    const detail = await this.systemService.updateUserEmailVerification(
      userId,
      dto
    );
    this.logSystemAdminAction(
      'admin_system.user_email_verification.update',
      request,
      user,
      {
        targetUserId: userId,
        emailVerified: dto.emailVerified
      }
    );
    return detail;
  }

  @Get('support-context')
  async getSupportContext(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string | undefined
  ) {
    this.systemService.assertSystemAdmin(user);
    const context = await this.systemService.findSupportContext(
      currentSessionId ?? ''
    );
    this.logSystemAdminAction('admin_support_context.read', request, user, {
      enabled: context.enabled
    });
    return context;
  }

  @Post('support-context')
  async updateSupportContext(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string | undefined,
    @Body() dto: UpdateAdminSupportContextDto
  ) {
    this.systemService.assertSystemAdmin(user);
    const context = await this.systemService.updateSupportContext(
      currentSessionId ?? '',
      dto
    );
    this.logSystemAdminAction('admin_support_context.update', request, user, {
      tenantId: dto.tenantId,
      ledgerId: context.ledger?.id ?? null
    });
    return context;
  }

  @Delete('support-context')
  async clearSupportContext(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string | undefined
  ) {
    this.systemService.assertSystemAdmin(user);
    const context = await this.systemService.clearSupportContext(
      currentSessionId ?? ''
    );
    this.logSystemAdminAction('admin_support_context.clear', request, user);
    return context;
  }

  @Get('operations/status')
  async getOperationsStatus(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.systemService.assertSystemAdmin(user);
    const status = await this.systemService.getOperationsStatus();
    this.logSystemAdminAction('admin_operations_status.read', request, user, {
      componentCount: status.components.length
    });
    return status;
  }

  @Get('members')
  async findMembers(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (user.isSystemAdmin) {
      const members = await this.memberQueryService.findAllAcrossTenants();
      this.logSystemAdminAction('admin_member.read_all', request, user, {
        memberCount: members.length
      });
      return members;
    }

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
    const workspace = await this.resolveWorkspaceForAdminCommand(user, {
      tenantId: dto.tenantId
    });
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
    const workspace = await this.resolveWorkspaceForAdminCommand(user, {
      membershipId
    });
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
    const workspace = await this.resolveWorkspaceForAdminCommand(user, {
      membershipId
    });
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
    const workspace = await this.resolveWorkspaceForAdminCommand(user, {
      membershipId
    });
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
    if (user.isSystemAdmin) {
      const response =
        await this.auditEventsService.findAllAcrossTenants(query);
      this.logSystemAdminAction('admin_audit_log.read_all', request, user, {
        eventCount: response.items.length,
        offset: response.offset,
        limit: response.limit
      });
      return response;
    }

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

  @Get('security-threats')
  async findSecurityThreatEvents(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminSecurityThreatEventsQueryDto
  ) {
    this.systemService.assertSystemAdmin(user);

    const response = await this.securityThreatEventsService.findAll(query);
    this.logSystemAdminAction('admin_security_threat.read_all', request, user, {
      eventCount: response.items.length,
      offset: response.offset,
      limit: response.limit
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
    if (user.isSystemAdmin) {
      const event =
        await this.auditEventsService.findOneAcrossTenants(auditEventId);
      this.logSystemAdminAction('admin_audit_log.read_all', request, user, {
        auditEventId
      });
      return event;
    }

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

  private async resolveWorkspaceForAdminCommand(
    user: AuthenticatedUser,
    target: {
      membershipId?: string;
      tenantId?: string;
    }
  ): Promise<ReturnType<typeof requireCurrentWorkspace>> {
    if (!user.isSystemAdmin) {
      return requireCurrentWorkspace(user);
    }

    if (target.membershipId) {
      return this.systemService.resolveWorkspaceForMembership(
        user,
        target.membershipId
      );
    }

    if (target.tenantId) {
      return this.systemService.resolveWorkspaceForTenant(
        user,
        target.tenantId
      );
    }

    throw new BadRequestException(
      '전역 관리자는 작업할 사업장을 선택해야 합니다.'
    );
  }

  private logSystemAdminAction(
    action: string,
    request: RequestWithContext,
    user: AuthenticatedUser,
    details: Record<string, string | number | boolean | null> = {}
  ): void {
    this.securityEvents.log('audit.action_succeeded', {
      requestId: readRequestId(request),
      path: readRequestPath(request),
      action,
      userId: user.id,
      systemRole: 'SYSTEM_ADMIN',
      ...details
    });
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
