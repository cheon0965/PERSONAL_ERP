// eslint-disable-next-line no-restricted-imports
import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsResponse,
  CollectImportedRowRequest
} from '@personal-erp/contracts';
// eslint-disable-next-line no-restricted-imports
import type { Prisma } from '@prisma/client';
// eslint-disable-next-line no-restricted-imports
import { TransactionType } from '@prisma/client';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ImportedRowCollectionService } from '../../imported-row-collection.service';

@Injectable()
export class BulkCollectImportedRowsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importedRowCollectionService: ImportedRowCollectionService
  ) {}

  async execute(
    user: AuthenticatedUser,
    importBatchId: string,
    input: BulkCollectImportedRowsRequest
  ): Promise<BulkCollectImportedRowsResponse> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.create'
    );

    const fundingAccountId = input.fundingAccountId.trim();
    if (!fundingAccountId) {
      throw new BadRequestException('일괄 등록에 사용할 계좌/카드를 선택해 주세요.');
    }

    const batch = await this.prisma.importBatch.findFirst({
      where: {
        id: importBatchId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      }
    });

    if (!batch) {
      throw new NotFoundException('업로드 배치를 찾을 수 없습니다.');
    }

    const requestedRowIds = normalizeOptionalRowIds(input.rowIds);
    const rows = await this.prisma.importedRow.findMany({
      where: {
        batchId: importBatchId,
        batch: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        ...(requestedRowIds
          ? {
              id: {
                in: requestedRowIds
              }
            }
          : {})
      },
      select: {
        id: true,
        rowNumber: true,
        parseStatus: true,
        rawPayload: true,
        createdCollectedTransaction: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        rowNumber: 'asc'
      }
    });

    if (requestedRowIds && rows.length !== requestedRowIds.length) {
      throw new NotFoundException(
        '선택한 업로드 행 일부를 찾을 수 없습니다.'
      );
    }

    const targetRows =
      requestedRowIds == null
        ? rows.filter(
            (row) => row.parseStatus === 'PARSED' && !row.createdCollectedTransaction
          )
        : rows;

    if (targetRows.length === 0) {
      throw new BadRequestException('일괄 등록할 업로드 행이 없습니다.');
    }

    const categoryId = normalizeOptionalString(input.categoryId);
    const memo = normalizeOptionalString(input.memo);
    const results: BulkCollectImportedRowsResponse['results'] = [];

    for (const row of targetRows) {
      if (row.parseStatus !== 'PARSED') {
        results.push({
          importedRowId: row.id,
          status: 'FAILED',
          collectedTransactionId: null,
          message: '파싱 완료 행만 수집 거래로 승격할 수 있습니다.'
        });
        continue;
      }

      if (row.createdCollectedTransaction) {
        results.push({
          importedRowId: row.id,
          status: 'FAILED',
          collectedTransactionId: row.createdCollectedTransaction.id,
          message: '이미 수집 거래로 승격된 업로드 행입니다.'
        });
        continue;
      }

      const request: CollectImportedRowRequest = {
        type: input.type ?? resolveBulkCollectType(row.rawPayload),
        fundingAccountId,
        ...(categoryId ? { categoryId } : {}),
        ...(memo ? { memo } : {})
      };

      try {
        const collected = await this.importedRowCollectionService.collectRow(
          user,
          importBatchId,
          row.id,
          request
        );

        results.push({
          importedRowId: row.id,
          status: 'COLLECTED',
          collectedTransactionId: collected.collectedTransaction.id,
          message:
            collected.preview.autoPreparation.decisionReasons.at(-1) ?? null
        });
      } catch (error) {
        results.push({
          importedRowId: row.id,
          status: 'FAILED',
          collectedTransactionId: null,
          message:
            error instanceof Error
              ? error.message
              : '업로드 행을 일괄 등록하지 못했습니다.'
        });
      }
    }

    return {
      importBatchId,
      requestedRowCount: targetRows.length,
      succeededCount: results.filter((result) => result.status === 'COLLECTED')
        .length,
      failedCount: results.filter((result) => result.status === 'FAILED').length,
      results
    };
  }
}

function normalizeOptionalRowIds(rowIds?: string[]): string[] | null {
  if (!rowIds) {
    return null;
  }

  const normalized = [...new Set(rowIds.map((rowId) => rowId.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveBulkCollectType(
  rawPayload: Prisma.JsonValue
): CollectImportedRowRequest['type'] {
  const parsed =
    rawPayload &&
    typeof rawPayload === 'object' &&
    !Array.isArray(rawPayload) &&
    'parsed' in rawPayload &&
    rawPayload.parsed &&
    typeof rawPayload.parsed === 'object' &&
    !Array.isArray(rawPayload.parsed)
      ? (rawPayload.parsed as Record<string, unknown>)
      : null;

  if (parsed?.collectTypeHint === 'REVERSAL') {
    return 'REVERSAL';
  }

  if (parsed?.direction === 'DEPOSIT') {
    return TransactionType.INCOME;
  }

  if (parsed?.direction === 'WITHDRAWAL') {
    return TransactionType.EXPENSE;
  }

  return TransactionType.EXPENSE;
}
