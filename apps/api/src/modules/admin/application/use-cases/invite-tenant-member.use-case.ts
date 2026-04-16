import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  InviteTenantMemberRequest,
  TenantMemberInvitationItem
} from '@personal-erp/contracts';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { EmailSenderPort } from '../../../../common/application/ports/email-sender.port';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import { WorkspaceAuditEventsService } from '../../../../common/infrastructure/operational/workspace-audit-events.service';
import type { RequestWithContext } from '../../../../common/infrastructure/operational/request-context';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  AdminMemberCommandSupportService,
  buildAdminInvitationEmail,
  buildAdminInvitationUrl,
  createAdminInvitationToken,
  getAdminInvitationExpiresAt,
  hashAdminInvitationToken,
  normalizeAdminInvitationEmail
} from '../../admin-member-command.support';
import { mapTenantMemberInvitationToItem } from '../../admin.mapper';

@Injectable()
export class InviteTenantMemberUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: EmailSenderPort,
    private readonly clock: ClockPort,
    private readonly auditEvents: WorkspaceAuditEventsService,
    private readonly commandSupport: AdminMemberCommandSupportService
  ) {}

  async execute(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    input: InviteTenantMemberRequest
  ): Promise<TenantMemberInvitationItem> {
    const email = normalizeAdminInvitationEmail(input.email);
    const now = this.clock.now();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      await this.commandSupport.assertNoBlockingMembership(
        workspace,
        existingUser.id
      );
    }

    await this.commandSupport.assertNoActiveInvitation(
      workspace.tenantId,
      email,
      now
    );

    const rawToken = createAdminInvitationToken();
    const invitation = await this.prisma.tenantMembershipInvitation.create({
      data: {
        tenantId: workspace.tenantId,
        email,
        normalizedEmail: email,
        role: input.role,
        tokenHash: hashAdminInvitationToken(rawToken),
        expiresAt: getAdminInvitationExpiresAt(now),
        invitedByMembershipId: workspace.membershipId
      }
    });

    if (existingUser) {
      await this.commandSupport.upsertInvitedMembership(
        workspace,
        existingUser.id,
        input.role
      );
    }

    try {
      await this.emailSender.send(
        buildAdminInvitationEmail({
          to: email,
          tenantName: workspace.tenantName,
          invitationUrl: buildAdminInvitationUrl(rawToken)
        })
      );
    } catch {
      await this.auditEvents.record({
        workspace,
        request,
        eventCategory: 'admin_member',
        eventName: 'admin.member_invitation_email_failed',
        action: 'admin_member.invite',
        resourceType: 'tenant_membership_invitation',
        resourceId: invitation.id,
        result: 'FAILED',
        reason: 'email_send_failed',
        metadata: {
          role: input.role
        }
      });
      throw new ServiceUnavailableException(
        '초대 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    }

    await this.auditEvents.record({
      workspace,
      request,
      eventCategory: 'admin_member',
      eventName: 'admin.member_invited',
      action: 'admin_member.invite',
      resourceType: 'tenant_membership_invitation',
      resourceId: invitation.id,
      result: 'SUCCESS',
      metadata: {
        role: input.role
      }
    });

    return mapTenantMemberInvitationToItem(invitation);
  }
}
