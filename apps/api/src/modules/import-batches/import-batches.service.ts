import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateImportBatchRequest,
  ImportBatchItem
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  importBatchRecordInclude,
  mapImportBatchRecordToItem,
  type ImportBatchRecord
} from './import-batch.mapper';
import { parseImportBatchContent } from './import-batch.policy';

@Injectable()
export class ImportBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser): Promise<ImportBatchItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const batches = await this.prisma.importBatch.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: importBatchRecordInclude,
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    return batches.map(mapImportBatchRecordToItem);
  }

  async findOne(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<ImportBatchItem> {
    const workspace = requireCurrentWorkspace(user);
    const batch = await this.prisma.importBatch.findFirst({
      where: {
        id: importBatchId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: importBatchRecordInclude
    });

    if (!batch) {
      throw new NotFoundException('업로드 배치를 찾을 수 없습니다.');
    }

    return mapImportBatchRecordToItem(batch);
  }

  async create(
    user: AuthenticatedUser,
    input: CreateImportBatchRequest
  ): Promise<ImportBatchItem> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'import_batch.upload'
    );

    const parsedBatch = parseImportBatchContent({
      sourceKind: input.sourceKind,
      content: input.content
    });
    const fileHash = createHash('sha256')
      .update(input.content, 'utf8')
      .digest('hex');

    const created = (await this.prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: null,
          sourceKind: input.sourceKind,
          fileName: input.fileName,
          fileHash,
          rowCount: parsedBatch.rowCount,
          parseStatus: parsedBatch.parseStatus,
          uploadedByMembershipId: workspace.membershipId
        }
      });

      const rows = [];
      for (const row of parsedBatch.rows) {
        rows.push(
          await tx.importedRow.create({
            data: {
              batchId: batch.id,
              rowNumber: row.rowNumber,
              rawPayload: row.rawPayload,
              parseStatus: row.parseStatus,
              parseError: row.parseError,
              sourceFingerprint: row.sourceFingerprint
            }
          })
        );
      }

      return {
        ...batch,
        rows
      };
    })) as ImportBatchRecord;

    return mapImportBatchRecordToItem(created);
  }
}
