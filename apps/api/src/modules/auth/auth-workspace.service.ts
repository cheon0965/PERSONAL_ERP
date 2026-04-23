import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  AuthenticatedWorkspaceListResponse,
  SwitchWorkspaceRequest,
  SwitchWorkspaceResponse
} from '@personal-erp/contracts';
import { AuthenticatedWorkspaceResolver } from '../../common/auth/authenticated-workspace-resolver';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { AuthSessionService } from './auth-session.service';
import type { AuthRequestContext } from './auth.types';

@Injectable()
export class AuthWorkspaceService {
  constructor(
    private readonly authenticatedWorkspaceResolver: AuthenticatedWorkspaceResolver,
    private readonly authSessions: AuthSessionService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async listWorkspaces(
    user: AuthenticatedUser
  ): Promise<AuthenticatedWorkspaceListResponse> {
    return {
      items:
        await this.authenticatedWorkspaceResolver.listAccessibleWorkspaces(
          user.id,
          user.currentWorkspace
        )
    };
  }

  async switchCurrentWorkspace(
    user: AuthenticatedUser,
    sessionId: string | undefined,
    input: SwitchWorkspaceRequest,
    context: AuthRequestContext
  ): Promise<SwitchWorkspaceResponse> {
    if (!sessionId) {
      throw new UnauthorizedException('Invalid session');
    }

    if (user.currentWorkspace?.supportContext?.enabled) {
      throw new BadRequestException(
        '지원 모드를 해제한 뒤 일반 사업장 전환을 실행해 주세요.'
      );
    }

    const selectedWorkspace =
      await this.authenticatedWorkspaceResolver.resolveSelectedWorkspace(
        user.id,
        {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId ?? null
        },
        Boolean(input.ledgerId)
      );

    if (!selectedWorkspace) {
      throw new ForbiddenException(
        '선택한 사업장 또는 장부에 접근할 수 없습니다.'
      );
    }

    await this.authSessions.updateCurrentWorkspace(sessionId, user.id, {
      tenantId: selectedWorkspace.tenant.id,
      ledgerId: selectedWorkspace.ledger?.id ?? null
    });

    const nextUser =
      await this.authenticatedWorkspaceResolver.buildAuthenticatedUser(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          ...(user.isSystemAdmin ? { isSystemAdmin: true } : {})
        },
        undefined,
        {
          tenantId: selectedWorkspace.tenant.id,
          ledgerId: selectedWorkspace.ledger?.id ?? null
        }
      );

    this.securityEvents.log('auth.workspace_switched', {
      requestId: context.requestId,
      clientIp: context.clientIp,
      userId: user.id,
      sessionId,
      tenantId: selectedWorkspace.tenant.id,
      ledgerId: selectedWorkspace.ledger?.id ?? null,
      membershipId: selectedWorkspace.membership.id
    });

    return {
      user: nextUser,
      workspaces:
        await this.authenticatedWorkspaceResolver.listAccessibleWorkspaces(
          user.id,
          nextUser.currentWorkspace
        )
    };
  }
}
