import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  AuthenticatedWorkspaceListResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteWorkspaceResponse,
  SwitchWorkspaceRequest,
  SwitchWorkspaceResponse
} from '@personal-erp/contracts';
import { Prisma } from '@prisma/client';
import { AuthenticatedWorkspaceResolver } from '../../common/auth/authenticated-workspace-resolver';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthSessionService } from './auth-session.service';
import type { AuthRequestContext } from './auth.types';
import { WorkspaceBootstrapService } from './workspace-bootstrap.service';

@Injectable()
export class AuthWorkspaceService {
  constructor(
    private readonly authenticatedWorkspaceResolver: AuthenticatedWorkspaceResolver,
    private readonly authSessions: AuthSessionService,
    private readonly prisma: PrismaService,
    private readonly workspaceBootstrap: WorkspaceBootstrapService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  async listWorkspaces(
    user: AuthenticatedUser
  ): Promise<AuthenticatedWorkspaceListResponse> {
    return {
      items: await this.authenticatedWorkspaceResolver.listAccessibleWorkspaces(
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

  async createWorkspace(
    user: AuthenticatedUser,
    sessionId: string | undefined,
    input: CreateWorkspaceRequest,
    context: AuthRequestContext
  ): Promise<CreateWorkspaceResponse> {
    if (!sessionId) {
      throw new UnauthorizedException('Invalid session');
    }

    if (user.currentWorkspace?.supportContext?.enabled) {
      throw new BadRequestException(
        '지원 모드를 해제한 뒤 새 사업장을 만들어 주세요.'
      );
    }

    try {
      const created = await this.prisma.$transaction((tx) =>
        this.workspaceBootstrap.createAdditionalWorkspaceForUser(
          tx,
          user.id,
          input
        )
      );

      await this.authSessions.updateCurrentWorkspace(sessionId, user.id, {
        tenantId: created.tenantId,
        ledgerId: created.ledgerId
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
            tenantId: created.tenantId,
            ledgerId: created.ledgerId
          }
        );

      this.securityEvents.log('auth.workspace_created', {
        requestId: context.requestId,
        clientIp: context.clientIp,
        userId: user.id,
        sessionId,
        tenantId: created.tenantId,
        ledgerId: created.ledgerId,
        membershipId: created.membershipId
      });

      return {
        user: nextUser,
        workspaces:
          await this.authenticatedWorkspaceResolver.listAccessibleWorkspaces(
            user.id,
            nextUser.currentWorkspace
          )
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          '이미 사용 중인 사업장 슬러그입니다. 다른 슬러그를 사용해 주세요.'
        );
      }

      throw error;
    }
  }

  async deleteWorkspace(
    user: AuthenticatedUser,
    sessionId: string | undefined,
    tenantId: string,
    context: AuthRequestContext
  ): Promise<DeleteWorkspaceResponse> {
    if (!sessionId) {
      throw new UnauthorizedException('Invalid session');
    }

    if (user.currentWorkspace?.supportContext?.enabled) {
      throw new BadRequestException(
        '지원 모드를 해제한 뒤 사업장을 삭제해 주세요.'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id
          }
        }
      });

      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException('삭제할 사업장에 접근할 수 없습니다.');
      }

      if (membership.role !== 'OWNER') {
        throw new ForbiddenException('사업장 소유자만 삭제할 수 있습니다.');
      }

      const activeWorkspaceCount = await tx.tenantMembership.count({
        where: {
          userId: user.id,
          status: 'ACTIVE'
        }
      });
      if (activeWorkspaceCount <= 1) {
        throw new BadRequestException(
          '마지막으로 남은 활성 사업장은 삭제할 수 없습니다.'
        );
      }

      const otherActiveMemberCount = await tx.tenantMembership.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          userId: {
            not: user.id
          }
        }
      });
      if (otherActiveMemberCount > 0) {
        throw new ConflictException(
          '다른 활성 멤버가 남아 있는 사업장은 삭제할 수 없습니다. 멤버를 먼저 제거해 주세요.'
        );
      }

      await tx.tenant.delete({
        where: { id: tenantId }
      });
    });

    const currentSelection =
      user.currentWorkspace?.tenant.id &&
      user.currentWorkspace.tenant.id !== tenantId
        ? {
            tenantId: user.currentWorkspace.tenant.id,
            ledgerId: user.currentWorkspace.ledger?.id ?? null
          }
        : undefined;
    const nextUser =
      await this.authenticatedWorkspaceResolver.buildAuthenticatedUser(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          ...(user.isSystemAdmin ? { isSystemAdmin: true } : {})
        },
        undefined,
        currentSelection
      );

    await this.authSessions.updateCurrentWorkspace(sessionId, user.id, {
      tenantId: nextUser.currentWorkspace?.tenant.id ?? null,
      ledgerId: nextUser.currentWorkspace?.ledger?.id ?? null
    });

    this.securityEvents.log('auth.workspace_deleted', {
      requestId: context.requestId,
      clientIp: context.clientIp,
      userId: user.id,
      sessionId,
      tenantId
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
