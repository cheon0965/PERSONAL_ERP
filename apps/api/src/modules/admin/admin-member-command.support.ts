import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { InviteTenantMemberRequest } from '@personal-erp/contracts';
import { createHash, randomBytes } from 'node:crypto';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getApiEnv } from '../../config/api-env';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminMemberCommandSupportService {
  constructor(private readonly prisma: PrismaService) {}

  async findMembershipInWorkspace(
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

  async assertAnotherActiveOwner(
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

  async assertNoBlockingMembership(
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

  async assertNoActiveInvitation(
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

  async upsertInvitedMembership(
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

export function normalizeAdminInvitationEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new BadRequestException('초대할 이메일을 입력해 주세요.');
  }

  return normalized;
}

export function createAdminInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAdminInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

export function getAdminInvitationExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

export function buildAdminInvitationUrl(token: string): string {
  const url = new URL('/accept-invitation', getApiEnv().APP_ORIGIN);
  url.searchParams.set('token', token);
  return url.toString();
}

export function buildAdminInvitationEmail(input: {
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
