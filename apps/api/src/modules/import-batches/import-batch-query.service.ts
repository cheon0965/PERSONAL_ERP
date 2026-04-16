import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  ImportBatchItem
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  importBatchRecordInclude,
  mapImportBatchRecordToItem
} from './import-batch.mapper';

@Injectable()
export class ImportBatchQueryService {
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
}
