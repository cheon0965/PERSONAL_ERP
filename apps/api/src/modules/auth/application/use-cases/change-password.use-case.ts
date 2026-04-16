import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import type { ChangePasswordResponse } from '@personal-erp/contracts';
import * as argon2 from 'argon2';
import type { RequiredWorkspaceContext } from '../../../../common/auth/required-workspace.util';
import {
  readClientIp,
  readRequestId,
  type RequestWithContext
} from '../../../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../../../common/infrastructure/operational/security-event.logger';
import { WorkspaceAuditEventsService } from '../../../../common/infrastructure/operational/workspace-audit-events.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthSessionService } from '../../auth-session.service';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessions: AuthSessionService,
    private readonly auditEvents: WorkspaceAuditEventsService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async execute(
    user: { id: string; email: string },
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    currentSessionId: string,
    input: { currentPassword: string; nextPassword: string }
  ): Promise<ChangePasswordResponse> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true
      }
    });

    if (!currentUser) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const currentPasswordMatches = await argon2.verify(
      currentUser.passwordHash,
      input.currentPassword
    );
    if (!currentPasswordMatches) {
      this.securityEvents.warn('auth.password_change_failed', {
        requestId: readRequestId(request),
        clientIp: readClientIp(request),
        userId: user.id,
        reason: 'invalid_current_password'
      });
      throw new UnauthorizedException(
        '현재 비밀번호가 올바르지 않습니다.'
      );
    }

    const nextPasswordMatchesCurrent = await argon2.verify(
      currentUser.passwordHash,
      input.nextPassword
    );
    if (nextPasswordMatchesCurrent) {
      throw new BadRequestException(
        '새 비밀번호는 현재 비밀번호와 달라야 합니다.'
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(input.nextPassword)
      }
    });
    const revokedSessionCount = await this.authSessions.revokeOtherUserSessions(
      user.id,
      currentSessionId
    );

    await this.auditEvents.record({
      workspace,
      request,
      eventCategory: 'account_security',
      eventName: 'account.password_changed',
      action: 'account_security.change_password',
      resourceType: 'user',
      resourceId: user.id,
      result: 'SUCCESS',
      metadata: {
        revokedSessionCount
      }
    });
    this.securityEvents.log('auth.password_changed', {
      requestId: readRequestId(request),
      clientIp: readClientIp(request),
      userId: user.id,
      sessionId: currentSessionId,
      revokedSessionCount
    });

    return { status: 'changed' };
  }
}
