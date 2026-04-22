export type OperationalAuditEventKind =
  | 'SECURITY_EVENT'
  | 'WORKSPACE_AUDIT_EVENT'
  | 'PERIOD_STATUS_HISTORY'
  | 'IMPORT_BATCH_COLLECTION_JOB'
  | 'JOURNAL_ADJUSTMENT';

export type OperationalAuditEventResult =
  | 'SUCCESS'
  | 'DENIED'
  | 'FAILED'
  | 'INFO';

export type OperationalAuditEventPayload = Record<
  string,
  string | number | boolean | null
>;

export type OperationalAuditSinkEvent = {
  kind: OperationalAuditEventKind;
  eventName: string;
  occurredAt: string;
  tenantId: string | null;
  ledgerId: string | null;
  actorUserId?: string | null;
  actorMembershipId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  result?: OperationalAuditEventResult;
  payload?: OperationalAuditEventPayload;
};

export abstract class OperationalAuditSinkPort {
  abstract publish(event: OperationalAuditSinkEvent): Promise<void>;
}
