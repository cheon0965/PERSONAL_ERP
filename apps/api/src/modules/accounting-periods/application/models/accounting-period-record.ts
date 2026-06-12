import type {
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  AuditActorType,
  OpeningBalanceSourceKind
} from '@personal-erp/contracts';

export type AccountingPeriodRecord = {
  id: string;
  tenantId: string;
  ledgerId: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: AccountingPeriodStatus;
  openedAt: Date;
  lockedAt: Date | null;
  openingBalanceSnapshot: {
    sourceKind: OpeningBalanceSourceKind;
  } | null;
  statusHistory: Array<{
    id: string;
    fromStatus: AccountingPeriodStatus | null;
    toStatus: AccountingPeriodStatus;
    eventType: AccountingPeriodEventType;
    reason: string | null;
    actorType: AuditActorType;
    actorMembershipId: string | null;
    changedAt: Date;
  }>;
};
