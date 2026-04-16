import type {
  AccountingPeriodItem,
  OperationsImportBatchStatusItem
} from '@personal-erp/contracts';
import type {
  CollectedTransactionStatus,
  ImportedRowParseStatus,
  Prisma
} from '@prisma/client';

export type ReferenceReadinessGap = {
  key: string;
  label: string;
  href: string;
};

export type ImportRowSnapshot = {
  parseStatus: ImportedRowParseStatus;
  createdCollectedTransaction?: { id: string } | null;
};

export type ImportBatchSnapshot = {
  id: string;
  sourceKind: OperationsImportBatchStatusItem['sourceKind'];
  fileName: string;
  rowCount: number;
  parseStatus: OperationsImportBatchStatusItem['parseStatus'];
  uploadedAt: Date;
  rows: ImportRowSnapshot[];
};

export type OperationsSnapshot = {
  generatedAt: string;
  currentPeriod: AccountingPeriodItem | null;
  readinessGaps: ReferenceReadinessGap[];
  unresolvedTransactions: Array<{
    id: string;
    title: string;
    status: CollectedTransactionStatus;
    occurredOn: Date;
  }>;
  importBatches: ImportBatchSnapshot[];
  remainingPlanItems: Array<{
    id: string;
    plannedAmount: Prisma.Decimal | number;
  }>;
  financialStatementSnapshotCount: number;
  carryForwardCreated: boolean;
  failedAuditEvents: Array<{
    id: string;
    eventName: string;
    requestId: string | null;
    occurredAt: Date;
  }>;
  successfulAuditEvents: Array<{
    id: string;
    eventName: string;
    requestId: string | null;
    occurredAt: Date;
  }>;
  deniedAuditEvents: Array<{
    id: string;
    eventName: string;
    action: string | null;
    requestId: string | null;
    occurredAt: Date;
  }>;
};
