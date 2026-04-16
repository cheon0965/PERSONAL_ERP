import { createHash } from 'node:crypto';
// eslint-disable-next-line no-restricted-imports
import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateImportBatchRequest,
  ImportBatchItem
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { mapImportBatchRecordToItem } from '../../import-batch.mapper';
import { parseImportBatchContent } from '../../import-batch.policy';
import { ImportBatchWritePort } from '../ports/import-batch-write.port';

@Injectable()
export class CreateImportBatchUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importBatchWritePort: ImportBatchWritePort
  ) {}

  async execute(
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

    const created = await this.prisma.$transaction((tx) =>
      this.importBatchWritePort.createBatchWithRows(tx, {
        workspace: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          membershipId: workspace.membershipId
        },
        sourceKind: input.sourceKind,
        fileName: input.fileName,
        fileHash,
        rowCount: parsedBatch.rowCount,
        parseStatus: parsedBatch.parseStatus,
        rows: parsedBatch.rows
      })
    );

    return mapImportBatchRecordToItem(created);
  }
}
