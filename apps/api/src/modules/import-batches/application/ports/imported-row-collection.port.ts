import type { CollectImportedRowRequest } from '@personal-erp/contracts';
// eslint-disable-next-line no-restricted-imports
import type { Prisma } from '@prisma/client';
// eslint-disable-next-line no-restricted-imports
import type { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  CollectableImportedRow,
  CollectingPeriodRecord,
  CreatedCollectedTransactionRecord,
  PlanItemCollectionCandidate
} from '../../imported-row-collection.types';

export type ImportedRowCollectionWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

export type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export type CreateCollectedTransactionRecordInput = {
  tx: Prisma.TransactionClient;
  workspace: ImportedRowCollectionWorkspaceScope;
  importBatchId: string;
  importedRowId: string;
  periodId: string;
  matchedPlanItemId: string | null;
  ledgerTransactionTypeId: string;
  fundingAccountId: string;
  categoryId: string | null;
  title: string;
  occurredOn: Date;
  amount: number;
  status: Prisma.CollectedTransactionCreateInput['status'];
  sourceFingerprint: string;
  memo: string | undefined;
};

export type AbsorbImportedRowIntoCollectedTransactionRecordInput = {
  tx: Prisma.TransactionClient;
  collectedTransactionId: string;
  matchedPlanItemId: string;
  importBatchId: string;
  importedRowId: string;
  periodId: string;
  ledgerTransactionTypeId: string;
  fundingAccountId: string;
  categoryId: string | null;
  title: string;
  occurredOn: Date;
  amount: number;
  status: Prisma.CollectedTransactionCreateInput['status'];
  sourceFingerprint: string;
  memo: string | undefined;
};

export abstract class ImportedRowCollectionPort {
  abstract readCollectableImportedRow(
    client: PrismaClientLike,
    workspace: ImportedRowCollectionWorkspaceScope,
    importBatchId: string,
    importedRowId: string
  ): Promise<CollectableImportedRow>;

  abstract readCurrentCollectingPeriod(
    tx: PrismaClientLike,
    workspace: ImportedRowCollectionWorkspaceScope,
    periodId: string
  ): Promise<CollectingPeriodRecord>;

  abstract readFundingAccount(
    tx: PrismaClientLike,
    workspace: ImportedRowCollectionWorkspaceScope,
    fundingAccountId: string
  ): Promise<{ id: string; name: string; type: 'BANK' | 'CASH' | 'CARD' }>;

  abstract readLedgerTransactionTypeId(
    tx: PrismaClientLike,
    workspace: ImportedRowCollectionWorkspaceScope,
    type: CollectImportedRowRequest['type']
  ): Promise<string>;

  abstract readMatchedPlanItemCandidate(
    tx: PrismaClientLike,
    workspace: ImportedRowCollectionWorkspaceScope,
    periodId: string,
    amount: number,
    occurredOn: Date,
    fundingAccountId: string,
    ledgerTransactionTypeId: string,
    categoryId: string | null
  ): Promise<PlanItemCollectionCandidate | null>;

  abstract hasDuplicateSourceFingerprint(
    tx: PrismaClientLike,
    workspace: ImportedRowCollectionWorkspaceScope,
    sourceFingerprint: string,
    currentImportBatchId: string
  ): Promise<boolean>;

  abstract countPotentialDuplicateTransactions(
    tx: PrismaClientLike,
    workspace: ImportedRowCollectionWorkspaceScope,
    occurredOn: Date,
    amount: number,
    ledgerTransactionTypeId: string,
    currentImportBatchId: string,
    excludedCollectedTransactionIds?: string[]
  ): Promise<number>;

  abstract createCollectedTransactionRecord(
    input: CreateCollectedTransactionRecordInput
  ): Promise<CreatedCollectedTransactionRecord>;

  abstract absorbImportedRowIntoCollectedTransactionRecord(
    input: AbsorbImportedRowIntoCollectedTransactionRecordInput
  ): Promise<CreatedCollectedTransactionRecord>;

  abstract markPlanItemMatched(
    tx: Prisma.TransactionClient,
    matchedPlanItemId: string | null
  ): Promise<void>;

  abstract readEffectiveCategory(
    tx: PrismaClientLike,
    workspace: ImportedRowCollectionWorkspaceScope,
    categoryId: string | null
  ): Promise<{ id: string; name: string } | null>;
}
