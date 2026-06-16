import type {
  ImportBatchParseStatus,
  ImportSourceKind,
  Prisma
} from '@prisma/client';
import type { ImportBatchRecord } from '../mappers/import-batch.mapper';
import type { ParsedImportedRowDraft } from '../parsers/delimited-import-batch.parser';

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
  fundingAccountId: string | null;
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
