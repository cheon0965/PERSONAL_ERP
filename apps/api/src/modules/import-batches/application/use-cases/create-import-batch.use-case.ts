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
import { resolveImportBatchFundingAccountId } from '../../import-batch-funding-account.policy';
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
    // 원본 내용의 해시를 보관해 같은 파일/붙여넣기 원본을 나중에 추적할 수 있게 한다.
    // 실제 중복 판단은 행 단위 fingerprint에서 다시 수행한다.
    const fileHash = createHash('sha256')
      .update(input.content, 'utf8')
      .digest('hex');
    const fundingAccountId = await resolveImportBatchFundingAccountId({
      client: this.prisma,
      workspace,
      fundingAccountId: input.fundingAccountId
    });

    const created = await this.prisma.$transaction(
      (tx) =>
        // 배치 헤더와 파싱된 행은 항상 함께 저장되어야 한다.
        // 헤더만 있고 행이 없는 중간 상태를 막기 위해 write port에 한 번에 위임한다.
        this.importBatchWritePort.createBatchWithRows(tx, {
          workspace: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            membershipId: workspace.membershipId
          },
          sourceKind: input.sourceKind,
          fileName: input.fileName,
          fileHash,
          fundingAccountId,
          rowCount: parsedBatch.rowCount,
          parseStatus: parsedBatch.parseStatus,
          rows: parsedBatch.rows
        }),
      { timeout: 15_000 }
    );

    return mapImportBatchRecordToItem(created);
  }
}
