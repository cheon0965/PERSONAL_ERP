import { Injectable } from '@nestjs/common';
import type {
  AdminSecurityThreatEventListResponse,
  AdminSecurityThreatEventQuery
} from '@personal-erp/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAdminSecurityThreatEventToItem } from './admin.mapper';

const DEFAULT_THREAT_LIMIT = 50;
const MAX_THREAT_LIMIT = 100;

@Injectable()
export class AdminSecurityThreatEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: AdminSecurityThreatEventQuery
  ): Promise<AdminSecurityThreatEventListResponse> {
    const offset = normalizeOffset(query.offset);
    const limit = normalizeLimit(query.limit);
    const where = {
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.eventCategory ? { eventCategory: query.eventCategory } : {}),
      ...(query.eventName ? { eventName: query.eventName } : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...(query.clientIpHash ? { clientIpHash: query.clientIpHash } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...buildOccurredAtFilter(query)
    };

    const [total, records] = await Promise.all([
      this.prisma.securityThreatEvent.count({ where }),
      this.prisma.securityThreatEvent.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit
      })
    ]);

    return {
      items: records.map(mapAdminSecurityThreatEventToItem),
      total,
      offset,
      limit
    };
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
    return DEFAULT_THREAT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_THREAT_LIMIT);
}

function buildOccurredAtFilter(query: AdminSecurityThreatEventQuery) {
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
