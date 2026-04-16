import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccountSecurityEventItem,
  AccountSecurityOverview
} from '@personal-erp/contracts';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthSessionService } from './auth-session.service';
import {
  mapAccountProfileItem,
  normalizeAccountEventMetadata
} from './auth-account-security.mapper';

@Injectable()
export class AuthAccountSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessions: AuthSessionService
  ) {}

  async getAccountSecurity(
    user: { id: string; email: string; name: string },
    workspace: RequiredWorkspaceContext,
    currentSessionId: string
  ): Promise<AccountSecurityOverview> {
    const userRecord = await this.prisma.user.findUnique({
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

    if (!userRecord) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const sessions = await this.authSessions.listUserSessions(
      user.id,
      currentSessionId
    );
    const recentEvents = await this.buildAccountSecurityEvents(
      user.id,
      workspace,
      sessions
    );

    return {
      profile: mapAccountProfileItem(userRecord, workspace.timezone),
      sessions,
      recentEvents
    };
  }

  private async buildAccountSecurityEvents(
    userId: string,
    workspace: RequiredWorkspaceContext,
    sessions: Array<{
      id: string;
      createdAt: string;
      revokedAt: string | null;
      isCurrent: boolean;
    }>
  ): Promise<AccountSecurityEventItem[]> {
    const accountAuditEvents = (
      await this.prisma.workspaceAuditEvent.findMany({
        where: {
          tenantId: workspace.tenantId
        },
        take: 50
      })
    )
      .filter(
        (candidate) =>
          candidate.actorUserId === userId &&
          (candidate.action === 'account_profile.update' ||
            candidate.action === 'account_security.change_password')
      )
      .map<AccountSecurityEventItem>((candidate) => ({
        id: candidate.id,
        kind:
          candidate.action === 'account_security.change_password'
            ? 'PASSWORD_CHANGED'
            : 'PROFILE_UPDATED',
        occurredAt: candidate.occurredAt.toISOString(),
        requestId: candidate.requestId ?? null,
        sessionId: null,
        metadata: normalizeAccountEventMetadata(candidate.metadata)
      }));

    const sessionEvents = sessions.flatMap<AccountSecurityEventItem>(
      (session) => {
        const createdEvent: AccountSecurityEventItem = {
          id: `session-created:${session.id}`,
          kind: 'SESSION_CREATED',
          occurredAt: session.createdAt,
          requestId: null,
          sessionId: session.id,
          metadata: {
            isCurrent: session.isCurrent
          }
        };

        if (!session.revokedAt) {
          return [createdEvent];
        }

        return [
          createdEvent,
          {
            id: `session-revoked:${session.id}`,
            kind: 'SESSION_REVOKED',
            occurredAt: session.revokedAt,
            requestId: null,
            sessionId: session.id,
            metadata: {
              isCurrent: session.isCurrent
            }
          }
        ];
      }
    );

    return [...accountAuditEvents, ...sessionEvents]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime()
      )
      .slice(0, 10);
  }
}
