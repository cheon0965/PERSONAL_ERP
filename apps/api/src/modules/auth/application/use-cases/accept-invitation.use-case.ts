import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AcceptInvitationResponse } from '@personal-erp/contracts';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { WorkspaceBootstrapService } from '../../workspace-bootstrap.service';
import type { AuthRequestContext } from '../../auth.types';
import { AcceptInvitationDto } from '../../dto/accept-invitation.dto';

const INVITATION_REGISTRATION_REQUIRED_RESPONSE = {
  status: 'registration_required' as const
};
const INVITATION_ACCEPTED_RESPONSE = { status: 'accepted' as const };

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockPort,
    private readonly securityEvents: SecurityEventLogger,
    private readonly workspaceBootstrap: WorkspaceBootstrapService
  ) {}

  async execute(
    dto: AcceptInvitationDto,
    context: AuthRequestContext
  ): Promise<AcceptInvitationResponse> {
    const tokenHash = hashInvitationToken(dto.token);

    try {
      const response = await this.prisma.$transaction(async (tx) => {
        const now = this.clock.now();
        const invitation = await tx.tenantMembershipInvitation.findUnique({
          where: { tokenHash }
        });

        if (!invitation) {
          throw createInvitationError(
            'invalid_membership_invitation_token',
            '초대 링크가 올바르지 않습니다.'
          );
        }

        if (invitation.acceptedAt) {
          throw createInvitationError(
            'consumed_membership_invitation_token',
            '이미 사용한 초대 링크입니다.'
          );
        }

        if (invitation.revokedAt) {
          throw createInvitationError(
            'revoked_membership_invitation_token',
            '취소된 초대 링크입니다.'
          );
        }

        if (invitation.expiresAt.getTime() <= now.getTime()) {
          throw createInvitationError(
            'expired_membership_invitation_token',
            '초대 링크가 만료되었습니다.'
          );
        }

        const user = await tx.user.findUnique({
          where: { email: invitation.normalizedEmail },
          select: { id: true, emailVerifiedAt: true }
        });

        if (!user) {
          return INVITATION_REGISTRATION_REQUIRED_RESPONSE;
        }

        const existingMembership = await tx.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: invitation.tenantId,
              userId: user.id
            }
          }
        });

        if (existingMembership) {
          await tx.tenantMembership.update({
            where: { id: existingMembership.id },
            data: {
              role: invitation.role,
              status: 'ACTIVE',
              invitedByMembershipId: invitation.invitedByMembershipId
            }
          });
        } else {
          await tx.tenantMembership.create({
            data: {
              tenantId: invitation.tenantId,
              userId: user.id,
              role: invitation.role,
              status: 'ACTIVE',
              invitedByMembershipId: invitation.invitedByMembershipId
            }
          });
        }

        if (!user.emailVerifiedAt) {
          await tx.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: now }
          });
        }

        await tx.tenantMembershipInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: now }
        });

        return INVITATION_ACCEPTED_RESPONSE;
      });

      this.securityEvents.log('auth.invitation_accepted', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        status: response.status
      });
      return response;
    } catch (error) {
      if (isInvitationError(error)) {
        this.securityEvents.warn('auth.invitation_accept_failed', {
          requestId: context.requestId,
          clientIp: context.clientIp,
          reason: (error as BadRequestException & { securityReason: string })
            .securityReason
        });
      }

      throw error;
    }
  }
}

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

function createInvitationError(
  reason: string,
  message: string
): BadRequestException & { securityReason: string } {
  const error = new BadRequestException(message) as BadRequestException & {
    securityReason: string;
  };
  error.securityReason = reason;
  return error;
}

function isInvitationError(
  error: unknown
): error is BadRequestException & { securityReason: string } {
  return (
    error instanceof BadRequestException &&
    typeof (error as { securityReason?: unknown }).securityReason === 'string'
  );
}
