import type {
  AccountingPeriodItem,
  AccountingPeriodStatus
} from './accounting';
import type { ImportBatchParseStatus, ImportSourceKind } from './imports';
import type { MoneyWon } from './money';

export type OperationsReadinessStatus =
  | 'READY'
  | 'ACTION_REQUIRED'
  | 'BLOCKED'
  | 'INFO';

export type OperationsSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type OperationsChecklistGroupKey =
  | 'MONTH_START'
  | 'DAILY'
  | 'MONTH_END'
  | 'DEPLOY';

export type OperationsChecklistItem = {
  id: string;
  title: string;
  description: string;
  status: OperationsReadinessStatus;
  detail: string;
  blockingReason: string | null;
  actionLabel: string;
  href: string;
};

export type OperationsChecklistGroup = {
  key: OperationsChecklistGroupKey;
  title: string;
  description: string;
  items: OperationsChecklistItem[];
};

export type OperationsChecklistResponse = {
  generatedAt: string;
  currentPeriod: AccountingPeriodItem | null;
  totals: {
    ready: number;
    actionRequired: number;
    blocked: number;
  };
  groups: OperationsChecklistGroup[];
};

export type OperationsExceptionKind =
  | 'REFERENCE_DATA'
  | 'COLLECTED_TRANSACTION'
  | 'IMPORT_ROW'
  | 'MONTH_CLOSE'
  | 'AUDIT_EVENT';

export type OperationsExceptionItem = {
  id: string;
  kind: OperationsExceptionKind;
  severity: OperationsSeverity;
  title: string;
  description: string;
  count: number;
  primaryActionLabel: string;
  href: string;
  lastOccurredAt: string | null;
};

export type OperationsExceptionsResponse = {
  generatedAt: string;
  totalCount: number;
  criticalCount: number;
  warningCount: number;
  items: OperationsExceptionItem[];
};

export type OperationsMonthEndSummary = {
  generatedAt: string;
  period: AccountingPeriodItem | null;
  periodStatus: AccountingPeriodStatus | null;
  closeReadiness: OperationsReadinessStatus;
  closeReadinessLabel: string;
  unresolvedTransactionCount: number;
  failedImportRowCount: number;
  remainingPlanItemCount: number;
  remainingPlannedExpenseWon: MoneyWon;
  financialStatementSnapshotCount: number;
  carryForwardCreated: boolean;
  blockers: string[];
  warnings: string[];
};

export type OperationsImportBatchStatusItem = {
  id: string;
  fileName: string;
  sourceKind: ImportSourceKind;
  parseStatus: ImportBatchParseStatus;
  uploadedAt: string;
  rowCount: number;
  parsedRowCount: number;
  failedRowCount: number;
  uncollectedRowCount: number;
  collectionRate: number;
};

export type OperationsImportStatusSummary = {
  generatedAt: string;
  totalBatchCount: number;
  totalRowCount: number;
  failedRowCount: number;
  uncollectedRowCount: number;
  collectedRowCount: number;
  collectionRate: number;
  latestUploadedAt: string | null;
  batches: OperationsImportBatchStatusItem[];
};

export type OperationsSystemComponentStatus =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'DOWN'
  | 'UNKNOWN';

export type OperationsSystemComponentItem = {
  key: string;
  label: string;
  status: OperationsSystemComponentStatus;
  detail: string;
  lastCheckedAt: string;
};

export type OperationsSystemMailStatus = {
  provider: 'console' | 'gmail-api';
  status: OperationsSystemComponentStatus;
  detail: string;
  lastBoundaryEventAt: string | null;
};

export type OperationsSystemStatusSummary = {
  generatedAt: string;
  overallStatus: OperationsSystemComponentStatus;
  components: OperationsSystemComponentItem[];
  build: {
    environment: string;
    nodeVersion: string;
    appVersion: string;
    commitSha: string | null;
    uptimeSeconds: number;
  };
  recentActivity: {
    lastSuccessfulAuditEventAt: string | null;
    lastFailedAuditEventAt: string | null;
    lastImportUploadedAt: string | null;
    lastEmailBoundaryEventAt: string | null;
  };
  mail: OperationsSystemMailStatus;
};

export type OperationsAlertKind =
  | 'REFERENCE_DATA'
  | 'IMPORT'
  | 'MONTH_CLOSE'
  | 'SECURITY'
  | 'SYSTEM';

export type OperationsAlertItem = {
  id: string;
  kind: OperationsAlertKind;
  severity: OperationsSeverity;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  sourceAuditEventId: string | null;
  requestId: string | null;
  createdAt: string;
};

export type OperationsAlertsResponse = {
  generatedAt: string;
  totalCount: number;
  criticalCount: number;
  warningCount: number;
  items: OperationsAlertItem[];
};

export type OperationsExportScope =
  | 'REFERENCE_DATA'
  | 'COLLECTED_TRANSACTIONS'
  | 'JOURNAL_ENTRIES'
  | 'FINANCIAL_STATEMENTS';

export type OperationsExportScopeItem = {
  scope: OperationsExportScope;
  label: string;
  description: string;
  rowCount: number;
  rangeLabel: string;
  latestSourceAt: string | null;
  latestExportedAt: string | null;
  recommendedCadence: string;
  enabled: boolean;
};

export type OperationsExportsResponse = {
  generatedAt: string;
  lastExportedAt: string | null;
  items: OperationsExportScopeItem[];
};

export type CreateOperationsExportRequest = {
  scope: OperationsExportScope;
  periodId?: string | null;
};

export type OperationsExportResult = {
  exportId: string;
  scope: OperationsExportScope;
  fileName: string;
  contentType: 'text/csv; charset=utf-8';
  encoding: 'utf-8';
  rowCount: number;
  rangeLabel: string;
  generatedAt: string;
  payload: string;
};

export type OperationsNoteKind =
  | 'GENERAL'
  | 'MONTH_END'
  | 'EXCEPTION'
  | 'ALERT'
  | 'FOLLOW_UP';

export type OperationsNoteItem = {
  id: string;
  kind: OperationsNoteKind;
  title: string;
  body: string;
  relatedHref: string | null;
  periodId: string | null;
  periodLabel: string | null;
  authorMembershipId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateOperationsNoteRequest = {
  kind: OperationsNoteKind;
  title: string;
  body: string;
  relatedHref?: string | null;
  periodId?: string | null;
};

export type OperationsNotesResponse = {
  generatedAt: string;
  totalCount: number;
  items: OperationsNoteItem[];
};

export type OperationsHubSummary = {
  generatedAt: string;
  checklist: OperationsChecklistResponse;
  exceptions: OperationsExceptionsResponse;
  monthEnd: OperationsMonthEndSummary;
  imports: OperationsImportStatusSummary;
  outstandingWorkCount: number;
};
