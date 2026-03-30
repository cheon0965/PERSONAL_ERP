import type { RequiredWorkspaceContext } from '../../auth/required-workspace.util';
import {
  readRequestId,
  readRequestPath,
  type RequestWithContext
} from './request-context';
import { SecurityEventLogger } from './security-event.logger';

type AuditDetailValue = string | number | boolean | undefined | null;
type AuditDetails = Record<string, AuditDetailValue>;

type WorkspaceActionAuditInput = {
  action: string;
  request: RequestWithContext;
  workspace: RequiredWorkspaceContext;
  details?: AuditDetails;
};

type WorkspaceActionDeniedAuditInput = WorkspaceActionAuditInput & {
  reason?: string;
};

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
    membershipRole: input.workspace.membershipRole,
    ...input.details
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
    membershipRole: input.workspace.membershipRole,
    ...input.details
  });
}
