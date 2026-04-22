import type {
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  AuditActorType
} from '@prisma/client';
import { OperationalAuditPublisher } from './operational-audit-publisher.service';

export type PeriodStatusHistoryAuditRecord = {
  id: string;
  tenantId: string;
  ledgerId: string;
  periodId: string;
  fromStatus: AccountingPeriodStatus | null;
  toStatus: AccountingPeriodStatus;
  eventType: AccountingPeriodEventType;
  reason: string | null;
  actorType: AuditActorType;
  actorMembershipId: string | null;
  changedAt: Date;
};

export function publishPeriodStatusHistoryAudit(
  auditPublisher: OperationalAuditPublisher,
  record: PeriodStatusHistoryAuditRecord
): void {
  auditPublisher.publish({
    kind: 'PERIOD_STATUS_HISTORY',
    eventName: `accounting_period.${record.eventType.toLowerCase()}`,
    occurredAt: record.changedAt.toISOString(),
    tenantId: record.tenantId,
    ledgerId: record.ledgerId,
    actorMembershipId: record.actorMembershipId,
    resourceType: 'accounting-period',
    resourceId: record.periodId,
    result: 'SUCCESS',
    payload: {
      periodStatusHistoryId: record.id,
      fromStatus: record.fromStatus,
      toStatus: record.toStatus,
      eventType: record.eventType,
      reason: record.reason
    }
  });
}
