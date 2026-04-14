import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import type {
  AdminMemberItem,
  InviteTenantMemberRequest,
  TenantMemberInvitationItem,
  UpdateTenantMemberRoleRequest,
  UpdateTenantMemberStatusRequest
} from '@personal-erp/contracts';
import { createHash, randomBytes } from 'node:crypto';
import { ClockPort } from '../../common/application/ports/clock.port';
import { EmailSenderPort } from '../../common/application/ports/email-sender.port';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { WorkspaceAuditEventsService } from '../../common/infrastructure/operational/workspace-audit-events.service';
import { type RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getApiEnv } from '../../config/api-env';
import {
  mapAdminMemberToItem,
  mapTenantMemberInvitationToItem
} from './admin.mapper';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: EmailSenderPort,
    private readonly clock: ClockPort,
    private readonly auditEvents: WorkspaceAuditEventsService
  ) {}

  async findAll(
    workspace: RequiredWorkspaceContext
  ): Promise<AdminMemberItem[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId: workspace.tenantId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailVerifiedAt: true
          }
        }
      },
      orderBy: [{ status: 'asc' }, { role: 'asc' }, { joinedAt: 'asc' }]
    });

    return memberships.map(mapAdminMemberToItem);
  }

  async invite(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    input: InviteTenantMemberRequest
  ): Promise<TenantMemberInvitationItem> {
    const email = normalizeEmail(input.email);
    const now = this.clock.now();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      await this.assertNoBlockingMembership(workspace, existingUser.id);
    }

    await this.assertNoActiveInvitation(workspace.tenantId, email, now);
    const rawToken = createInvitationToken();
    const invitation = await this.prisma.tenantMembershipInvitation.create({
      data: {
        tenantId: workspace.tenantId,
        email,
        normalizedEmail: email,
        role: input.role,
        tokenHash: hashInvitationToken(rawToken),
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        invitedByMembershipId: workspace.membershipId
      }
    });

    if (existingUser) {
      await this.upsertInvitedMembership(
        workspace,
        existingUser.id,
        input.role
      );
    }

    try {
      await this.emailSender.send(
        buildInvitationEmail({
          to: email,
          tenantName: workspace.tenantName,
          invitationUrl: buildInvitationUrl(rawToken)
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

  async updateRole(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    membershipId: string,
    input: UpdateTenantMemberRoleRequest
  ): Promise<AdminMemberItem> {
    const membership = await this.findMembershipInWorkspace(
      workspace,
      membershipId
    );

    if (membership.role === 'OWNER' && input.role !== 'OWNER') {
      await this.assertAnotherActiveOwner(workspace, membership.id);
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

  async updateStatus(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    membershipId: string,
    input: UpdateTenantMemberStatusRequest
  ): Promise<AdminMemberItem> {
    const membership = await this.findMembershipInWorkspace(
      workspace,
      membershipId
    );

    if (membership.role === 'OWNER' && input.status !== 'ACTIVE') {
      await this.assertAnotherActiveOwner(workspace, membership.id);
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

  async remove(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    membershipId: string
  ): Promise<void> {
    const membership = await this.findMembershipInWorkspace(
      workspace,
      membershipId
    );

    if (membership.role === 'OWNER') {
      await this.assertAnotherActiveOwner(workspace, membership.id);
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

  private async findMembershipInWorkspace(
    workspace: RequiredWorkspaceContext,
    membershipId: string
  ) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: membershipId,
        tenantId: workspace.tenantId
      },
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

    if (!membership) {
      throw new NotFoundException('Workspace member not found');
    }

    return membership;
  }

  private async assertAnotherActiveOwner(
    workspace: RequiredWorkspaceContext,
    targetMembershipId: string
  ): Promise<void> {
    const activeOwnerCount = await this.prisma.tenantMembership.count({
      where: {
        tenantId: workspace.tenantId,
        role: 'OWNER',
        status: 'ACTIVE',
        id: {
          not: targetMembershipId
        }
      }
    });

    if (activeOwnerCount < 1) {
      throw new BadRequestException(
        '최소 1명의 활성 소유자가 남아 있어야 합니다.'
      );
    }
  }

  private async assertNoBlockingMembership(
    workspace: RequiredWorkspaceContext,
    userId: string
  ): Promise<void> {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: workspace.tenantId,
          userId
        }
      }
    });

    if (!membership || membership.status === 'REMOVED') {
      return;
    }

    throw new ConflictException('이미 이 사업장에 연결된 사용자입니다.');
  }

  private async assertNoActiveInvitation(
    tenantId: string,
    email: string,
    now: Date
  ): Promise<void> {
    const invitation = await this.prisma.tenantMembershipInvitation.findFirst({
      where: {
        tenantId,
        normalizedEmail: email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: now
        }
      }
    });

    if (invitation) {
      throw new ConflictException('아직 유효한 초대가 남아 있습니다.');
    }
  }

  private async upsertInvitedMembership(
    workspace: RequiredWorkspaceContext,
    userId: string,
    role: InviteTenantMemberRequest['role']
  ): Promise<void> {
    const existing = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: workspace.tenantId,
          userId
        }
      }
    });

    if (existing) {
      await this.prisma.tenantMembership.update({
        where: { id: existing.id },
        data: {
          role,
          status: 'INVITED',
          invitedByMembershipId: workspace.membershipId
        }
      });
      return;
    }

    await this.prisma.tenantMembership.create({
      data: {
        tenantId: workspace.tenantId,
        userId,
        role,
        status: 'INVITED',
        invitedByMembershipId: workspace.membershipId
      }
    });
  }
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new BadRequestException('초대할 이메일을 입력해 주세요.');
  }

  return normalized;
}

function createInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

function buildInvitationUrl(token: string): string {
  const url = new URL('/accept-invitation', getApiEnv().APP_ORIGIN);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildInvitationEmail(input: {
  to: string;
  tenantName: string;
  invitationUrl: string;
}) {
  const text = [
    `${input.tenantName} 사업장에 초대되었습니다.`,
    '',
    `초대 수락 링크: ${input.invitationUrl}`,
    '',
    '본인이 요청하지 않았다면 이 메일을 무시해 주세요.'
  ].join('\n');

  return {
    to: input.to,
    subject: 'PERSONAL_ERP 사업장 초대',
    text,
    html: [
      '<p>',
      escapeHtml(input.tenantName),
      ' 사업장에 초대되었습니다.</p>',
      '<p><a href="',
      escapeHtml(input.invitationUrl),
      '">초대 수락하기</a></p>',
      '<p>본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>'
    ].join('')
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
