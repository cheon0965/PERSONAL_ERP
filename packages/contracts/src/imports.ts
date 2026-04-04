import type {
  CollectedTransactionItem,
  CollectedTransactionPostingStatus,
  CollectedTransactionType
} from './transactions';

export type ImportSourceKind = 'CARD_EXCEL' | 'BANK_CSV' | 'MANUAL_UPLOAD';

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

export type ImportedRowAutoPreparationSummary = {
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
  effectiveCategoryId: string | null;
  effectiveCategoryName: string | null;
  nextWorkflowStatus: CollectedTransactionPostingStatus;
  hasDuplicateSourceFingerprint: boolean;
  allowPlanItemMatch: boolean;
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
  content: string;
};

export type CollectImportedRowRequest = {
  type: CollectedTransactionType;
  fundingAccountId: string;
  categoryId?: string;
  memo?: string;
};

export type CollectImportedRowPreview = {
  importedRowId: string;
  occurredOn: string;
  title: string;
  amountWon: number;
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
