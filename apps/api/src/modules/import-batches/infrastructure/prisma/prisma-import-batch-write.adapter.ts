import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type CreateImportBatchRecordInput,
  ImportBatchWritePort
} from '../../application/ports/import-batch-write.port';
import {
  importBatchRecordInclude,
  type ImportBatchRecord
} from '../../import-batch.mapper';

@Injectable()
export class PrismaImportBatchWriteAdapter extends ImportBatchWritePort {
  async createBatchWithRows(
    tx: Prisma.TransactionClient,
    input: CreateImportBatchRecordInput
  ): Promise<ImportBatchRecord> {
    const batch = await tx.importBatch.create({
      data: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        periodId: null,
        sourceKind: input.sourceKind,
        fileName: input.fileName,
        fileHash: input.fileHash,
        rowCount: input.rowCount,
        parseStatus: input.parseStatus,
        uploadedByMembershipId: input.workspace.membershipId
      }
    });

    for (const row of input.rows) {
      await tx.importedRow.create({
        data: {
          batchId: batch.id,
          rowNumber: row.rowNumber,
          rawPayload: row.rawPayload,
          parseStatus: row.parseStatus,
          parseError: row.parseError,
          sourceFingerprint: row.sourceFingerprint
        }
      });
    }

    const createdBatch = await tx.importBatch.findFirst({
      where: {
        id: batch.id,
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId
      },
      include: importBatchRecordInclude
    });

    if (!createdBatch) {
      throw new Error('Created import batch could not be reloaded.');
    }

    return createdBatch as ImportBatchRecord;
  }
}
