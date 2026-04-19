import type { RequiredWorkspaceContext } from '../../auth/required-workspace.util';
import {
  readRequestId,
  readRequestPath,
  type RequestWithContext
} from './request-context';
import { SecurityEventLogger } from './security-event.logger';

type AuditDetailValue = string | number | boolean | undefined | null;
export type AuditDetails = Record<string, AuditDetailValue>;

type WorkspaceActionAuditInput = {
  action: string;
  request: RequestWithContext;
  workspace: RequiredWorkspaceContext;
  details?: AuditDetails;
  persist?: boolean;
};

type WorkspaceActionDeniedAuditInput = WorkspaceActionAuditInput & {
  reason?: string;
};

export type WorkspaceActionAuditRecordInput = {
  action: string;
  request: RequestWithContext;
  workspace: RequiredWorkspaceContext;
  details?: AuditDetails;
  eventName: 'audit.action_succeeded' | 'authorization.action_denied';
  result: 'SUCCESS' | 'DENIED';
  reason?: string;
};

type WorkspaceActionAuditRecorder = (
  input: WorkspaceActionAuditRecordInput
) => Promise<void> | void;

let workspaceActionAuditRecorder: WorkspaceActionAuditRecorder | null = null;

export function registerWorkspaceActionAuditRecorder(
  recorder: WorkspaceActionAuditRecorder | null
): void {
  workspaceActionAuditRecorder = recorder;
}

export function logWorkspaceActionSucceeded(
  logger: SecurityEventLogger,
  input: WorkspaceActionAuditInput
): void {
  logger.log('audit.action_succeeded', {
    requestId: readRequestId(input.request),
    path: readRequestPath(input.request),
    action: input.action,
    userId: input.workspace.userId,
    tenantId: input.workspace.tenantId,
    ledgerId: input.workspace.ledgerId,
    membershipId: input.workspace.membershipId,
    membershipRole:
      input.workspace.systemRole ?? input.workspace.membershipRole,
    ...input.details
  });
  persistWorkspaceActionAudit({
    action: input.action,
    request: input.request,
    workspace: input.workspace,
    details: input.details,
    eventName: 'audit.action_succeeded',
    result: 'SUCCESS',
    persist: input.persist
  });
}

export function logWorkspaceActionDenied(
  logger: SecurityEventLogger,
  input: WorkspaceActionDeniedAuditInput
): void {
  logger.warn('authorization.action_denied', {
    requestId: readRequestId(input.request),
    path: readRequestPath(input.request),
    action: input.action,
    reason: input.reason ?? 'insufficient_membership_role',
    userId: input.workspace.userId,
    tenantId: input.workspace.tenantId,
    ledgerId: input.workspace.ledgerId,
    membershipId: input.workspace.membershipId,
    membershipRole:
      input.workspace.systemRole ?? input.workspace.membershipRole,
    ...input.details
  });
  persistWorkspaceActionAudit({
    action: input.action,
    request: input.request,
    workspace: input.workspace,
    details: input.details,
    eventName: 'authorization.action_denied',
    result: 'DENIED',
    reason: input.reason ?? 'insufficient_membership_role',
    persist: input.persist
  });
}

function persistWorkspaceActionAudit(
  input: WorkspaceActionAuditRecordInput & { persist?: boolean }
): void {
  if (input.persist === false || !workspaceActionAuditRecorder) {
    return;
  }

  void Promise.resolve(
    workspaceActionAuditRecorder({
      action: input.action,
      request: input.request,
      workspace: input.workspace,
      details: input.details,
      eventName: input.eventName,
      result: input.result,
      reason: input.reason
    })
  ).catch(() => undefined);
}
