import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccountProfileItem } from '@personal-erp/contracts';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import {
  readClientIp,
  readRequestId,
  type RequestWithContext
} from '../../../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { WorkspaceAuditEventsService } from '../../../../common/infrastructure/operational/workspace-audit-events.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { mapAccountProfileItem } from '../../auth-account-security.mapper';
import { normalizeDisplayName } from '../../auth.normalization';

@Injectable()
export class UpdateAccountProfileUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEvents: WorkspaceAuditEventsService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async execute(
    user: { id: string },
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    input: { name: string }
  ): Promise<AccountProfileItem> {
    const nextName = normalizeDisplayName(input.name);
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        settings: {
          select: {
            timezone: true
          }
        }
      }
    });

    if (!currentUser) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (currentUser.name !== nextName) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: nextName
        }
      });

      await this.auditEvents.record({
        workspace,
        request,
        eventCategory: 'account_profile',
        eventName: 'account.profile_updated',
        action: 'account_profile.update',
        resourceType: 'user',
        resourceId: user.id,
        result: 'SUCCESS',
        metadata: {
          previousName: currentUser.name,
          nextName
        }
      });
      this.securityEvents.log('auth.account_profile_updated', {
        requestId: readRequestId(request),
        clientIp: readClientIp(request),
        userId: user.id
      });
    }

    return mapAccountProfileItem(
      {
        ...currentUser,
        name: nextName
      },
      workspace.timezone
    );
  }
}
