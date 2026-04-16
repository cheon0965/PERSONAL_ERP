import { Injectable } from '@nestjs/common';
import type {
  AdminMemberItem,
  UpdateTenantMemberRoleRequest
} from '@personal-erp/contracts';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { WorkspaceAuditEventsService } from '../../../../common/infrastructure/operational/workspace-audit-events.service';
import type { RequestWithContext } from '../../../../common/infrastructure/operational/request-context';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AdminMemberCommandSupportService } from '../../admin-member-command.support';
import { mapAdminMemberToItem } from '../../admin.mapper';

@Injectable()
export class UpdateTenantMemberRoleUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEvents: WorkspaceAuditEventsService,
    private readonly commandSupport: AdminMemberCommandSupportService
  ) {}

  async execute(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    membershipId: string,
    input: UpdateTenantMemberRoleRequest
  ): Promise<AdminMemberItem> {
    const membership = await this.commandSupport.findMembershipInWorkspace(
      workspace,
      membershipId
    );

    if (membership.role === 'OWNER' && input.role !== 'OWNER') {
      await this.commandSupport.assertAnotherActiveOwner(
        workspace,
        membership.id
      );
    }

    const updated = await this.prisma.tenantMembership.update({
      where: { id: membership.id },
      data: { role: input.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailVerifiedAt: true
          }
        }
      }
    });

    await this.auditEvents.record({
      workspace,
      request,
      eventCategory: 'admin_member',
      eventName: 'admin.member_role_updated',
      action: 'admin_member.update_role',
      resourceType: 'tenant_membership',
      resourceId: membership.id,
      result: 'SUCCESS',
      metadata: {
        previousRole: membership.role,
        nextRole: input.role
      }
    });

    return mapAdminMemberToItem(updated);
  }
}
