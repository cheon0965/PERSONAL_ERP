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
  memo?: string;
};

export type BulkCollectImportedRowsRequest = {
  rowIds?: string[];
  type?: CollectedTransactionType;
  fundingAccountId: string;
  categoryId?: string;
  memo?: string;
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

export type BulkCollectImportedRowsResultItem = {
  importedRowId: string;
  status: 'COLLECTED' | 'FAILED';
  collectedTransactionId: string | null;
  message: string | null;
};

export type BulkCollectImportedRowsResponse = {
  importBatchId: string;
  requestedRowCount: number;
  succeededCount: number;
  failedCount: number;
  results: BulkCollectImportedRowsResultItem[];
};
