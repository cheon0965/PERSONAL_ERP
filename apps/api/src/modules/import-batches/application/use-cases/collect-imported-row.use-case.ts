// eslint-disable-next-line no-restricted-imports
import { ConflictException, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowRequest,
  CollectImportedRowResponse
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ImportedRowCollectionService } from '../../imported-row-collection.service';

@Injectable()
export class CollectImportedRowUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importedRowCollectionService: ImportedRowCollectionService
  ) {}

  async execute(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectImportedRowResponse> {
    const workspace = requireCurrentWorkspace(user);
    const activeLock = await this.prisma.importBatchCollectionLock.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        importBatchId: true
      }
    });

    if (activeLock) {
      throw new ConflictException(
        activeLock.importBatchId === importBatchId
          ? '이 업로드 배치에서 이미 일괄 등록 작업이 진행 중입니다. 진행률을 확인해 주세요.'
          : '현재 워크스페이스에서 다른 업로드 배치 일괄 등록이 진행 중입니다. 완료 후 다시 시도해 주세요.'
      );
    }

    return this.importedRowCollectionService.collectRow(
      user,
      importBatchId,
      importedRowId,
      input
    );
  }
}
