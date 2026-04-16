import { Injectable } from '@nestjs/common';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { WorkspaceAuditEventsService } from '../../../../common/infrastructure/operational/workspace-audit-events.service';
import type { RequestWithContext } from '../../../../common/infrastructure/operational/request-context';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AdminMemberCommandSupportService } from '../../admin-member-command.support';

@Injectable()
export class RemoveTenantMemberUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEvents: WorkspaceAuditEventsService,
    private readonly commandSupport: AdminMemberCommandSupportService
  ) {}

  async execute(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    membershipId: string
  ): Promise<void> {
    const membership = await this.commandSupport.findMembershipInWorkspace(
      workspace,
      membershipId
    );

    if (membership.role === 'OWNER') {
      await this.commandSupport.assertAnotherActiveOwner(
        workspace,
        membership.id
      );
    }

    await this.prisma.tenantMembership.update({
      where: { id: membership.id },
      data: { status: 'REMOVED' }
    });

    await this.auditEvents.record({
      workspace,
      request,
      eventCategory: 'admin_member',
      eventName: 'admin.member_removed',
      action: 'admin_member.remove',
      resourceType: 'tenant_membership',
      resourceId: membership.id,
      result: 'SUCCESS',
      metadata: {
        previousStatus: membership.status,
        nextStatus: 'REMOVED'
      }
    });
  }
}
