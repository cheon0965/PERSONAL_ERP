import type {
  CollectedTransactionItem,
  CollectedTransactionPostingStatus,
  CollectedTransactionType
} from './transactions';
import type { MoneyWon } from './money';
import type { AccountType } from './reference-data';

export type ImportSourceKind =
  | 'CARD_EXCEL'
  | 'BANK_CSV'
  | 'MANUAL_UPLOAD'
  | 'IM_BANK_PDF';

export type ImportBatchParseStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED';

export type ImportedRowParseStatus =
  | 'PENDING'
  | 'PARSED'
  | 'FAILED'
  | 'SKIPPED';

export type ImportBatchCollectionJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export type ImportBatchCollectionJobRowStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COLLECTED'
  | 'FAILED'
  | 'SKIPPED';

export type ImportedRowAutoPreparationSummary = {
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
  effectiveCategoryId: string | null;
  effectiveCategoryName: string | null;
  nextWorkflowStatus: CollectedTransactionPostingStatus;
  hasDuplicateSourceFingerprint: boolean;
  allowPlanItemMatch: boolean;
  potentialDuplicateTransactionCount?: number;
  decisionReasons: string[];
};

export type ImportedRowCollectionSummary = {
  createdCollectedTransactionId: string;
  createdCollectedTransactionTitle: string;
  createdCollectedTransactionStatus: CollectedTransactionPostingStatus;
  autoPreparation: ImportedRowAutoPreparationSummary;
};

export type ImportedRowItem = {
  id: string;
  rowNumber: number;
  parseStatus: ImportedRowParseStatus;
  parseError: string | null;
  sourceFingerprint: string | null;
  createdCollectedTransactionId: string | null;
  collectionSummary: ImportedRowCollectionSummary | null;
  rawPayload: Record<string, unknown>;
};

export type ImportBatchItem = {
  id: string;
  sourceKind: ImportSourceKind;
  fileName: string;
  fileHash: string;
  fundingAccountId: string | null;
  fundingAccountName: string | null;
  fundingAccountType: AccountType | null;
  rowCount: number;
  parseStatus: ImportBatchParseStatus;
  uploadedAt: string;
  parsedRowCount: number;
  failedRowCount: number;
  rows: ImportedRowItem[];
};

export type CreateImportBatchRequest = {
  sourceKind: ImportSourceKind;
  fileName: string;
  fundingAccountId?: string | null;
  content: string;
};

export type CollectImportedRowRequest = {
  type: CollectedTransactionType;
  fundingAccountId: string;
  categoryId?: string;
  confirmPotentialDuplicate?: boolean;
  memo?: string;
};

export type BulkCollectImportedRowsTypeOption = {
  type: CollectedTransactionType;
  categoryId?: string;
  memo?: string;
};

export type BulkCollectImportedRowsRequest = {
  rowIds?: string[];
  type?: CollectedTransactionType;
  fundingAccountId: string;
  categoryId?: string;
  memo?: string;
  typeOptions?: BulkCollectImportedRowsTypeOption[];
};

export type CancelImportBatchCollectionResponse = {
  importBatchId: string;
  cancelledTransactionCount: number;
  restoredPlanItemCount: number;
};

export type ImportBatchCollectionJobResultItem = {
  importedRowId: string;
  rowNumber: number;
  status: ImportBatchCollectionJobRowStatus;
  collectedTransactionId: string | null;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ImportBatchCollectionJobItem = {
  id: string;
  importBatchId: string;
  status: ImportBatchCollectionJobStatus;
  requestedRowCount: number;
  processedRowCount: number;
  succeededCount: number;
  failedCount: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  results: ImportBatchCollectionJobResultItem[];
};

export type CollectImportedRowPreview = {
  importedRowId: string;
  occurredOn: string;
  title: string;
  amountWon: MoneyWon;
  fundingAccountId: string;
  fundingAccountName: string;
  type: CollectedTransactionType;
  requestedCategoryId: string | null;
  requestedCategoryName: string | null;
  autoPreparation: ImportedRowAutoPreparationSummary;
};

export type CollectImportedRowResponse = {
  collectedTransaction: CollectedTransactionItem;
  preview: CollectImportedRowPreview;
};

export type BulkCollectImportedRowsResponse = ImportBatchCollectionJobItem;
