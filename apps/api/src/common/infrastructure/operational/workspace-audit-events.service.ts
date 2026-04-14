import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { AdminAuditEventResult } from '@personal-erp/contracts';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { RequiredWorkspaceContext } from '../../auth/required-workspace.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  readClientIp,
  readRequestId,
  readRequestPath,
  type RequestWithContext
} from './request-context';
import { SecurityEventLogger } from './security-event.logger';
import {
  registerWorkspaceActionAuditRecorder,
  type AuditDetails,
  type WorkspaceActionAuditRecordInput
} from './workspace-action.audit';

type AuditMetadataValue = string | number | boolean | null | undefined;
type AuditMetadata = Record<string, AuditMetadataValue>;

export type RecordWorkspaceAuditEventInput = {
  workspace: RequiredWorkspaceContext;
  request: RequestWithContext;
  eventCategory: string;
  eventName: string;
  action?: string;
  resourceType?: string;
  resourceId?: string | null;
  result: AdminAuditEventResult;
  reason?: string;
  metadata?: AuditMetadata;
};

@Injectable()
export class WorkspaceAuditEventsService
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  onModuleInit(): void {
    registerWorkspaceActionAuditRecorder((input) =>
      this.recordWorkspaceAction(input)
    );
  }

  onModuleDestroy(): void {
    registerWorkspaceActionAuditRecorder(null);
  }

  async record(input: RecordWorkspaceAuditEventInput): Promise<void> {
    try {
      await this.prisma.workspaceAuditEvent.create({
        data: {
          tenantId: input.workspace.tenantId,
          ledgerId: input.workspace.ledgerId,
          actorUserId: input.workspace.userId,
          actorMembershipId: input.workspace.membershipId,
          actorRole: input.workspace.membershipRole,
          eventCategory: input.eventCategory,
          eventName: input.eventName,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? undefined,
          result: input.result,
          reason: input.reason,
          requestId: readRequestId(input.request),
          path: readRequestPath(input.request),
          clientIpHash: hashClientIp(readClientIp(input.request)),
          metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonObject
        }
      });
    } catch {
      this.securityEvents.error('audit.workspace_event_persist_failed', {
        requestId: readRequestId(input.request),
        path: readRequestPath(input.request),
        action: input.action,
        eventName: input.eventName
      });
    }
  }

  private async recordWorkspaceAction(
    input: WorkspaceActionAuditRecordInput
  ): Promise<void> {
    await this.record({
      workspace: input.workspace,
      request: input.request,
      eventCategory: inferEventCategory(input.action),
      eventName: input.eventName,
      action: input.action,
      resourceType: inferResourceType(input.action, input.details),
      resourceId: inferResourceId(input.details),
      result: input.result,
      reason: input.reason,
      metadata: input.details
    });
  }
}

function inferEventCategory(action: string): string {
  const [category] = action.split('.');
  return category?.trim() || 'workspace';
}

function inferResourceType(
  action: string,
  details: AuditDetails | undefined
): string | undefined {
  const explicit = details?.resourceType;
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim();
  }

  const [category] = action.split('.');
  return category?.trim() || undefined;
}

function inferResourceId(details: AuditDetails | undefined): string | undefined {
  if (!details) {
    return undefined;
  }

  const explicit = details.resourceId;
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim();
  }

  for (const [key, value] of Object.entries(details)) {
    if (!key.endsWith('Id')) {
      continue;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function hashClientIp(clientIp: string | undefined): string | undefined {
  if (!clientIp) {
    return undefined;
  }

  return createHash('sha256').update(clientIp, 'utf8').digest('hex');
}

function sanitizeMetadata(
  metadata: AuditMetadata | undefined
): Record<string, string | number | boolean | null> {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }

      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        return [[key, value]];
      }

      return [];
    })
  );
}
