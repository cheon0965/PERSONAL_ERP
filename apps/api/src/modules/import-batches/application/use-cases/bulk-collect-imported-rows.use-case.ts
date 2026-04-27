// eslint-disable-next-line no-restricted-imports
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsResponse
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { readCollectingAccountingPeriodStatuses } from '../../../accounting-periods/public';
import {
  normalizeBulkCollectRequest,
  normalizeBulkCollectRowIds
} from '../../bulk-collect-imported-rows.policy';
import { readParsedImportedRowPayload } from '../../import-batch.policy';
import {
  importBatchCollectionJobSelect,
  mapImportBatchCollectionJobToItem
} from '../../import-batch-collection-job.mapper';
import { ImportBatchCollectionJobRunner } from '../../import-batch-collection-job-runner.service';

const IMPORT_COLLECTION_LOCK_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class BulkCollectImportedRowsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobRunner: ImportBatchCollectionJobRunner
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

    const normalizedRequest = normalizeBulkCollectRequest(input);
    if (!normalizedRequest.fundingAccountId) {
      throw new BadRequestException(
        '일괄 등록에 사용할 계좌/카드를 선택해 주세요.'
      );
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

    const requestedRowIds = normalizeBulkCollectRowIds(input.rowIds);
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
      throw new NotFoundException('선택한 업로드 행 일부를 찾을 수 없습니다.');
    }

    // 사용자가 행을 명시하지 않으면 아직 수집 거래로 연결되지 않은 파싱 완료 행만 대상으로 삼는다.
    // 명시 선택한 경우에는 선택 자체를 사용자의 의도로 보고 이후 검증에서 실패 사유를 행별로 남긴다.
    const collectableCandidateRows =
      requestedRowIds == null
        ? rows.filter(
            (row) =>
              row.parseStatus === 'PARSED' && !row.createdCollectedTransaction
          )
        : rows;
    const latestCollectingPeriod = await this.prisma.accountingPeriod.findFirst(
      {
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: {
            in: [...readCollectingAccountingPeriodStatuses()]
          }
        },
        select: {
          year: true,
          month: true,
          startDate: true,
          endDate: true
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }
    );
    const targetRows = latestCollectingPeriod
      ? collectableCandidateRows.filter((row) =>
          isImportedRowWithinPeriod(row.rawPayload, latestCollectingPeriod)
        )
      : collectableCandidateRows;

    // 업로드 배치는 과거 여러 달을 한꺼번에 되살리는 도구가 아니다.
    // 최신 진행월이 열려 있으면 그 월 범위에 들어오는 행만 일괄 등록 대상으로 제한한다.
    if (targetRows.length === 0) {
      throw new BadRequestException(
        latestCollectingPeriod
          ? `${formatYearMonth(latestCollectingPeriod.year, latestCollectingPeriod.month)} 운영월 범위에 해당하는 일괄 등록 대상 업로드 행이 없습니다.`
          : '일괄 등록할 업로드 행이 없습니다.'
      );
    }

    const now = new Date();
    const lockExpiresAt = new Date(
      now.getTime() + IMPORT_COLLECTION_LOCK_TTL_MS
    );
    const createdJob = await this.prisma.$transaction(async (tx) => {
      // 오래된 잠금은 정리하고, 살아 있는 잠금이 있으면 새 Job 생성을 막는다.
      // 이 잠금은 API 프로세스 안의 비동기 runner와 사용자 단건 등록을 동시에 보호한다.
      await tx.importBatchCollectionLock.deleteMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          expiresAt: {
            lt: now
          }
        }
      });

      const activeLock = await tx.importBatchCollectionLock.findFirst({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        select: {
          jobId: true,
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

      // Job과 대상 행 목록을 먼저 영속화한다. 이후 runner가 실패하더라도
      // 사용자는 Job 상세에서 어떤 행까지 처리됐는지 확인할 수 있다.
      const job = await tx.importBatchCollectionJob.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          importBatchId,
          requestedByMembershipId: workspace.membershipId,
          requestedRowCount: targetRows.length,
          requestPayload: normalizedRequest,
          rows: {
            create: targetRows.map((row) => ({
              importedRowId: row.id,
              rowNumber: row.rowNumber
            }))
          }
        },
        select: importBatchCollectionJobSelect
      });

      await tx.importBatchCollectionLock.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          importBatchId,
          jobId: job.id,
          lockedByMembershipId: workspace.membershipId,
          expiresAt: lockExpiresAt
        }
      });

      return job;
    });

    this.jobRunner.start(createdJob.id, user);
    return mapImportBatchCollectionJobToItem(createdJob);
  }
}

function isImportedRowWithinPeriod(
  rawPayload: Parameters<typeof readParsedImportedRowPayload>[0],
  period: {
    startDate: Date;
    endDate: Date;
  }
): boolean {
  const parsed = readParsedImportedRowPayload(rawPayload);
  if (!parsed) {
    return false;
  }

  const occurredOn = new Date(`${parsed.occurredOn}T00:00:00.000Z`);
  return (
    occurredOn.getTime() >= period.startDate.getTime() &&
    occurredOn.getTime() < period.endDate.getTime()
  );
}

function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
