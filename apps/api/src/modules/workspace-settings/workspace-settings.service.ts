import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  UpdateWorkspaceSettingsRequest,
  WorkspaceSettingsItem
} from '@personal-erp/contracts';
import { Prisma } from '@prisma/client';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { WorkspaceAuditEventsService } from '../../common/infrastructure/operational/workspace-audit-events.service';
import type { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WorkspaceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEvents: WorkspaceAuditEventsService
  ) {}

  async getCurrent(
    workspace: RequiredWorkspaceContext
  ): Promise<WorkspaceSettingsItem> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: workspace.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true
      }
    });
    const ledger = await this.prisma.ledger.findUnique({
      where: { id: workspace.ledgerId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        baseCurrency: true,
        timezone: true,
        status: true,
        openedFromYearMonth: true,
        closedThroughYearMonth: true
      }
    });

    if (!tenant || !ledger || ledger.tenantId !== workspace.tenantId) {
      throw new NotFoundException('Workspace settings not found');
    }

    return mapWorkspaceSettingsItem(workspace, tenant, ledger);
  }

  async update(
    workspace: RequiredWorkspaceContext,
    request: RequestWithContext,
    input: UpdateWorkspaceSettingsRequest
  ): Promise<WorkspaceSettingsItem> {
    const current = await this.getCurrent(workspace);
    const nextTenantName = normalizeWorkspaceName(input.tenantName);
    const nextTenantSlug = normalizeWorkspaceSlug(input.tenantSlug);
    const nextLedgerName = normalizeLedgerName(input.ledgerName);
    const nextBaseCurrency = normalizeCurrency(input.baseCurrency);
    const nextTimezone = normalizeTimezone(input.timezone);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const [tenant, ledger] = await Promise.all([
          tx.tenant.update({
            where: { id: workspace.tenantId },
            data: {
              name: nextTenantName,
              slug: nextTenantSlug,
              status: input.tenantStatus
            },
            select: {
              id: true,
              name: true,
              slug: true,
              status: true
            }
          }),
          tx.ledger.update({
            where: { id: workspace.ledgerId },
            data: {
              name: nextLedgerName,
              baseCurrency: nextBaseCurrency,
              timezone: nextTimezone
            },
            select: {
              id: true,
              tenantId: true,
              name: true,
              baseCurrency: true,
              timezone: true,
              status: true,
              openedFromYearMonth: true,
              closedThroughYearMonth: true
            }
          })
        ]);

        return { tenant, ledger };
      });

      await this.auditEvents.record({
        workspace,
        request,
        eventCategory: 'workspace_settings',
        eventName: 'workspace.settings_updated',
        action: 'workspace_settings.update',
        resourceType: 'tenant',
        resourceId: workspace.tenantId,
        result: 'SUCCESS',
        metadata: {
          previousTenantName: current.tenant.name,
          nextTenantName,
          previousTenantSlug: current.tenant.slug,
          nextTenantSlug,
          previousTenantStatus: current.tenant.status,
          nextTenantStatus: input.tenantStatus,
          previousLedgerName: current.ledger.name,
          nextLedgerName,
          previousBaseCurrency: current.ledger.baseCurrency,
          nextBaseCurrency,
          previousTimezone: current.ledger.timezone,
          nextTimezone
        }
      });

      return mapWorkspaceSettingsItem(
        workspace,
        updated.tenant,
        updated.ledger
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          '이미 사용 중인 사업장 슬러그입니다. 다른 슬러그를 사용해 주세요.'
        );
      }

      throw error;
    }
  }
}

function mapWorkspaceSettingsItem(
  workspace: RequiredWorkspaceContext,
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: WorkspaceSettingsItem['tenant']['status'];
  },
  ledger: {
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
    status: WorkspaceSettingsItem['ledger']['status'];
    openedFromYearMonth: string;
    closedThroughYearMonth: string | null;
  }
): WorkspaceSettingsItem {
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status
    },
    ledger: {
      id: ledger.id,
      name: ledger.name,
      baseCurrency: ledger.baseCurrency,
      timezone: ledger.timezone,
      status: ledger.status,
      openedFromYearMonth: ledger.openedFromYearMonth,
      closedThroughYearMonth: ledger.closedThroughYearMonth
    },
    membershipRole: workspace.membershipRole,
    canManage:
      workspace.membershipRole === 'OWNER' ||
      workspace.membershipRole === 'MANAGER'
  };
}

function normalizeWorkspaceName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new BadRequestException('사업장 이름을 입력해 주세요.');
  }

  return normalized;
}

function normalizeWorkspaceSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new BadRequestException('사업장 슬러그를 입력해 주세요.');
  }

  return normalized;
}

function normalizeLedgerName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new BadRequestException('기본 장부 이름을 입력해 주세요.');
  }

  return normalized;
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeTimezone(value: string): string {
  return value.trim();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
