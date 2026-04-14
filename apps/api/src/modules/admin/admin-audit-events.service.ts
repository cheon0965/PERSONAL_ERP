import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminAuditEventItem,
  AdminAuditEventListResponse,
  AdminAuditEventQuery
} from '@personal-erp/contracts';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAdminAuditEventToItem } from './admin.mapper';

const DEFAULT_AUDIT_LIMIT = 50;
const MAX_AUDIT_LIMIT = 100;

@Injectable()
export class AdminAuditEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    workspace: RequiredWorkspaceContext,
    query: AdminAuditEventQuery
  ): Promise<AdminAuditEventListResponse> {
    const offset = normalizeOffset(query.offset);
    const limit = normalizeLimit(query.limit);
    const where = {
      tenantId: workspace.tenantId,
      ...(query.eventCategory ? { eventCategory: query.eventCategory } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.actorMembershipId
        ? { actorMembershipId: query.actorMembershipId }
        : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...buildOccurredAtFilter(query)
    };

    const [total, records] = await Promise.all([
      this.prisma.workspaceAuditEvent.count({ where }),
      this.prisma.workspaceAuditEvent.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit
      })
    ]);

    return {
      items: records.map(mapAdminAuditEventToItem),
      total,
      offset,
      limit
    };
  }

  async findOne(
    workspace: RequiredWorkspaceContext,
    auditEventId: string
  ): Promise<AdminAuditEventItem> {
    const record = await this.prisma.workspaceAuditEvent.findFirst({
      where: {
        id: auditEventId,
        tenantId: workspace.tenantId
      }
    });

    if (!record) {
      throw new NotFoundException('Audit event not found');
    }

    return mapAdminAuditEventToItem(record);
  }
}

function normalizeOffset(offset: number | undefined): number {
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    return DEFAULT_AUDIT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_AUDIT_LIMIT);
}

function buildOccurredAtFilter(query: AdminAuditEventQuery) {
  const from = parseDate(query.from);
  const to = parseDate(query.to);

  if (!from && !to) {
    return {};
  }

  return {
    occurredAt: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {})
    }
  };
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
