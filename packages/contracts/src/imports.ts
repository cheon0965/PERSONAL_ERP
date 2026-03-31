import type { CollectedTransactionType } from './transactions';

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

export type ImportedRowItem = {
  id: string;
  rowNumber: number;
  parseStatus: ImportedRowParseStatus;
  parseError: string | null;
  sourceFingerprint: string | null;
  createdCollectedTransactionId: string | null;
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
