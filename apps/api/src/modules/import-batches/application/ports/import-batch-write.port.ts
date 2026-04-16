// eslint-disable-next-line no-restricted-imports
import type {
  ImportBatchParseStatus,
  ImportSourceKind,
  Prisma
} from '@prisma/client';
import type { ImportBatchRecord } from '../../import-batch.mapper';
import type { ParsedImportedRowDraft } from '../../import-batch.policy';

export type ImportBatchWorkspace = {
  tenantId: string;
  ledgerId: string;
  membershipId: string;
};

export type CreateImportBatchRecordInput = {
  workspace: ImportBatchWorkspace;
  sourceKind: ImportSourceKind;
  fileName: string;
  fileHash: string;
  rowCount: number;
  parseStatus: ImportBatchParseStatus;
  rows: ParsedImportedRowDraft[];
};

export abstract class ImportBatchWritePort {
  abstract createBatchWithRows(
    tx: Prisma.TransactionClient,
    input: CreateImportBatchRecordInput
  ): Promise<ImportBatchRecord>;
}
