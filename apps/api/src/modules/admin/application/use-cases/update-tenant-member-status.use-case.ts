import { Injectable } from '@nestjs/common';
import type {
  AdminMemberItem,
  UpdateTenantMemberStatusRequest
} from '@personal-erp/contracts';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { WorkspaceAuditEventsService } from '../../../../common/infrastructure/operational/workspace-audit-events.service';
import type { RequestWithContext } from '../../../../common/infrastructure/operational/request-context';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AdminMemberCommandSupportService } from '../../admin-member-command.support';
import { mapAdminMemberToItem } from '../../admin.mapper';

@Injectable()
export class UpdateTenantMemberStatusUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEvents: WorkspaceAuditEventsService,
    private readonly commandSupport: AdminMemberCommandSupportService
  ) {}

  async execute(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    membershipId: string,
    input: UpdateTenantMemberStatusRequest
  ): Promise<AdminMemberItem> {
    const membership = await this.commandSupport.findMembershipInWorkspace(
      workspace,
      membershipId
    );

    if (membership.role === 'OWNER' && input.status !== 'ACTIVE') {
      await this.commandSupport.assertAnotherActiveOwner(
        workspace,
        membership.id
      );
    }

    const updated = await this.prisma.tenantMembership.update({
      where: { id: membership.id },
      data: { status: input.status },
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
      eventName: 'admin.member_status_updated',
      action: 'admin_member.update_status',
      resourceType: 'tenant_membership',
      resourceId: membership.id,
      result: 'SUCCESS',
      metadata: {
        previousStatus: membership.status,
        nextStatus: input.status
      }
    });

    return mapAdminMemberToItem(updated);
  }
}
