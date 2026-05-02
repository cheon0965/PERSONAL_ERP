import { Injectable, Logger } from '@nestjs/common';
import type {
  AuthenticatedUser,
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsTypeOption,
  CollectedTransactionType
} from '@personal-erp/contracts';
import {
  ImportBatchCollectionJobRowStatus,
  ImportBatchCollectionJobStatus,
  Prisma
} from '@prisma/client';
import { OperationalAuditPublisher } from '../../common/infrastructure/operational/operational-audit-publisher.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildCollectRequestForBulkRow } from './bulk-collect-imported-rows.policy';
import { IMPORT_COLLECTION_LOCK_TTL_MS } from './import-batch-collection-job.constants';
import { ImportedRowCollectionService } from './imported-row-collection.service';

const JOB_PROGRESS_FLUSH_ROW_INTERVAL = 5;
const JOB_PROGRESS_FLUSH_INTERVAL_MS = 1_000;

/**
 * 업로드 배치의 여러 행을 백그라운드에서 수집 거래로 승격하는 Job Runner입니다.
 *
 * 대량 승격은 HTTP 요청 안에서 모두 처리하면 타임아웃과 부분 실패 처리가 어렵습니다. 그래서 요청은 Job만 만들고,
 * 실행기가 행 단위 성공/실패/`SKIPPED` 상태를 기록해 사용자가 어떤 행을 다시 처리해야 하는지 알 수 있게 합니다.
 */
@Injectable()
export class ImportBatchCollectionJobRunner {
  private readonly logger = new Logger(ImportBatchCollectionJobRunner.name);
  private readonly runningJobIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly importedRowCollectionService: ImportedRowCollectionService,
    private readonly auditPublisher: OperationalAuditPublisher
  ) {}

  start(jobId: string, user: AuthenticatedUser): void {
    if (this.runningJobIds.has(jobId)) {
      return;
    }

    // 요청 API는 작업 생성까지만 기다리고, 실제 행 처리는 이벤트 루프 다음 턴에 넘긴다.
    // 같은 프로세스 안 중복 실행은 runningJobIds로 막고, DB 잠금은 프로세스 간 충돌을 막는다.
    this.runningJobIds.add(jobId);
    setTimeout(() => {
      void this.run(jobId, user).finally(() => {
        this.runningJobIds.delete(jobId);
      });
    }, 0);
  }

  private async run(jobId: string, user: AuthenticatedUser): Promise<void> {
    const job = await this.prisma.importBatchCollectionJob.findFirst({
      where: {
        id: jobId
      },
      include: {
        rows: {
          orderBy: {
            rowNumber: 'asc'
          }
        }
      }
    });

    if (!job || job.status !== ImportBatchCollectionJobStatus.PENDING) {
      return;
    }

    const request = readBulkCollectRequest(job.requestPayload);
    const startedAt = new Date();
    await this.prisma.importBatchCollectionJob.update({
      where: {
        id: job.id
      },
      data: {
        status: ImportBatchCollectionJobStatus.RUNNING,
        startedAt,
        heartbeatAt: startedAt,
        processedRowCount: 0,
        succeededCount: 0,
        failedCount: 0,
        errorMessage: null
      }
    });

    let processedRowCount = 0;
    let succeededCount = 0;
    let failedCount = 0;
    let lastProgressFlushedAt = startedAt;

    try {
      // 행 단위로 성공/실패를 기록한다. 한 행 실패가 전체 Job을 즉시 중단하지 않도록
      // 개별 실패는 행 결과로 남기고, 마지막에 SUCCEEDED/PARTIAL/FAILED를 결정한다.
      for (const row of job.rows) {
        if (await this.isJobCancelled(job.id)) {
          await this.finishJob({
            jobId: job.id,
            tenantId: job.tenantId,
            ledgerId: job.ledgerId,
            importBatchId: job.importBatchId,
            requestedRowCount: job.requestedRowCount,
            status: ImportBatchCollectionJobStatus.CANCELLED,
            processedRowCount,
            succeededCount,
            failedCount,
            errorMessage: '사용자가 업로드 배치 일괄 등록 작업을 중단했습니다.'
          });
          return;
        }

        const result = await this.processRow({
          jobId: job.id,
          importBatchId: job.importBatchId,
          rowId: row.id,
          importedRowId: row.importedRowId,
          user,
          request
        });

        processedRowCount += 1;
        if (result === ImportBatchCollectionJobRowStatus.COLLECTED) {
          succeededCount += 1;
        } else if (result === ImportBatchCollectionJobRowStatus.FAILED) {
          failedCount += 1;
        }

        const progressCheckedAt = new Date();
        if (
          shouldFlushJobProgress({
            processedRowCount,
            lastRowStatus: result,
            lastProgressFlushedAt,
            checkedAt: progressCheckedAt
          })
        ) {
          lastProgressFlushedAt = await this.updateJobProgress({
            jobId: job.id,
            processedRowCount,
            succeededCount,
            failedCount
          });
        }

        if (await this.isJobCancelled(job.id)) {
          await this.finishJob({
            jobId: job.id,
            tenantId: job.tenantId,
            ledgerId: job.ledgerId,
            importBatchId: job.importBatchId,
            requestedRowCount: job.requestedRowCount,
            status: ImportBatchCollectionJobStatus.CANCELLED,
            processedRowCount,
            succeededCount,
            failedCount,
            errorMessage: '사용자가 업로드 배치 일괄 등록 작업을 중단했습니다.'
          });
          return;
        }
      }

      await this.finishJob({
        jobId: job.id,
        tenantId: job.tenantId,
        ledgerId: job.ledgerId,
        importBatchId: job.importBatchId,
        requestedRowCount: job.requestedRowCount,
        status: resolveFinalJobStatus({
          succeededCount,
          failedCount
        }),
        processedRowCount,
        succeededCount,
        failedCount,
        errorMessage: null
      });
    } catch (error) {
      this.logger.error(
        `Import batch collection job failed: ${job.id}`,
        error instanceof Error ? error.stack : undefined
      );
      await this.finishJob({
        jobId: job.id,
        tenantId: job.tenantId,
        ledgerId: job.ledgerId,
        importBatchId: job.importBatchId,
        requestedRowCount: job.requestedRowCount,
        status: ImportBatchCollectionJobStatus.FAILED,
        processedRowCount,
        succeededCount,
        failedCount: Math.max(
          failedCount,
          job.requestedRowCount - succeededCount
        ),
        errorMessage:
          error instanceof Error
            ? error.message
            : '업로드 배치 일괄 등록 작업이 중단되었습니다.'
      });
    }
  }

  private async processRow(input: {
    jobId: string;
    importBatchId: string;
    rowId: string;
    importedRowId: string;
    user: AuthenticatedUser;
    request: BulkCollectImportedRowsRequest;
  }): Promise<ImportBatchCollectionJobRowStatus> {
    // 행 하나의 결과를 독립적으로 확정한다.
    // 실패를 throw로 전파하지 않고 row 상태에 남겨 전체 Job이 부분 성공으로 끝날 수 있게 한다.
    const startedAt = new Date();
    await this.prisma.importBatchCollectionJobRow.update({
      where: {
        id: input.rowId
      },
      data: {
        status: ImportBatchCollectionJobRowStatus.RUNNING,
        startedAt,
        message: null
      }
    });

    const importedRow = await this.prisma.importedRow.findFirst({
      where: {
        id: input.importedRowId,
        batchId: input.importBatchId
      },
      select: {
        id: true,
        parseStatus: true,
        rawPayload: true,
        createdCollectedTransaction: {
          select: {
            id: true
          }
        }
      }
    });

    // 실행기는 오래 실행될 수 있으므로 각 행 처리 직전에 현재 행 상태를 다시 읽는다.
    // 이미 다른 경로로 승격된 행은 실패가 아니라 SKIPPED로 남겨 재시도 판단을 쉽게 한다.
    if (!importedRow) {
      await this.markRowFinished({
        rowId: input.rowId,
        status: ImportBatchCollectionJobRowStatus.FAILED,
        collectedTransactionId: null,
        message: '업로드 행을 찾을 수 없습니다.'
      });
      return ImportBatchCollectionJobRowStatus.FAILED;
    }

    if (importedRow.parseStatus !== 'PARSED') {
      await this.markRowFinished({
        rowId: input.rowId,
        status: ImportBatchCollectionJobRowStatus.FAILED,
        collectedTransactionId: null,
        message: '파싱 완료 행만 수집 거래로 승격할 수 있습니다.'
      });
      return ImportBatchCollectionJobRowStatus.FAILED;
    }

    if (importedRow.createdCollectedTransaction) {
      await this.markRowFinished({
        rowId: input.rowId,
        status: ImportBatchCollectionJobRowStatus.SKIPPED,
        collectedTransactionId: importedRow.createdCollectedTransaction.id,
        message: '이미 수집 거래로 승격된 업로드 행입니다.'
      });
      return ImportBatchCollectionJobRowStatus.SKIPPED;
    }

    try {
      const collected = await this.importedRowCollectionService.collectRow(
        input.user,
        input.importBatchId,
        importedRow.id,
        buildCollectRequestForBulkRow({
          request: input.request,
          rawPayload: importedRow.rawPayload
        })
      );

      await this.markRowFinished({
        rowId: input.rowId,
        status: ImportBatchCollectionJobRowStatus.COLLECTED,
        collectedTransactionId: collected.collectedTransaction.id,
        message: readCollectionJobSuccessMessage(
          collected.preview.autoPreparation
        )
      });
      return ImportBatchCollectionJobRowStatus.COLLECTED;
    } catch (error) {
      await this.markRowFinished({
        rowId: input.rowId,
        status: ImportBatchCollectionJobRowStatus.FAILED,
        collectedTransactionId: null,
        message:
          error instanceof Error
            ? error.message
            : '업로드 행을 일괄 등록하지 못했습니다.'
      });
      return ImportBatchCollectionJobRowStatus.FAILED;
    }
  }

  private async markRowFinished(input: {
    rowId: string;
    status: ImportBatchCollectionJobRowStatus;
    collectedTransactionId: string | null;
    message: string | null;
  }) {
    await this.prisma.importBatchCollectionJobRow.update({
      where: {
        id: input.rowId
      },
      data: {
        status: input.status,
        collectedTransactionId: input.collectedTransactionId,
        message: input.message,
        finishedAt: new Date()
      }
    });
  }

  private async updateJobProgress(input: {
    jobId: string;
    processedRowCount: number;
    succeededCount: number;
    failedCount: number;
  }): Promise<Date> {
    const heartbeatAt = new Date();
    await this.prisma.importBatchCollectionJob.update({
      where: {
        id: input.jobId
      },
      data: {
        processedRowCount: input.processedRowCount,
        succeededCount: input.succeededCount,
        failedCount: input.failedCount,
        heartbeatAt
      }
    });
    // 진행률 갱신과 함께 잠금 만료 시각을 연장한다.
    // 처리 중인 Job이 느리다는 이유만으로 다른 등록 작업이 끼어드는 것을 막기 위함이다.
    await this.prisma.importBatchCollectionLock.updateMany({
      where: {
        jobId: input.jobId
      },
      data: {
        expiresAt: new Date(
          heartbeatAt.getTime() + IMPORT_COLLECTION_LOCK_TTL_MS
        )
      }
    });

    return heartbeatAt;
  }

  private async finishJob(input: {
    jobId: string;
    tenantId: string;
    ledgerId: string;
    importBatchId: string;
    requestedRowCount: number;
    status: ImportBatchCollectionJobStatus;
    processedRowCount: number;
    succeededCount: number;
    failedCount: number;
    errorMessage: string | null;
  }) {
    const finishedAt = new Date();
    if (input.status === ImportBatchCollectionJobStatus.CANCELLED) {
      await this.prisma.importBatchCollectionJob.update({
        where: {
          id: input.jobId
        },
        data: {
          status: input.status,
          processedRowCount: input.processedRowCount,
          succeededCount: input.succeededCount,
          failedCount: input.failedCount,
          errorMessage: input.errorMessage,
          finishedAt,
          heartbeatAt: finishedAt
        }
      });
    } else {
      // 완료 직전에 사용자가 취소했다면 runner가 성공/실패 상태로 덮어쓰지 않게 한다.
      const updated = await this.prisma.importBatchCollectionJob.updateMany({
        where: {
          id: input.jobId,
          status: {
            not: ImportBatchCollectionJobStatus.CANCELLED
          }
        },
        data: {
          status: input.status,
          processedRowCount: input.processedRowCount,
          succeededCount: input.succeededCount,
          failedCount: input.failedCount,
          errorMessage: input.errorMessage,
          finishedAt,
          heartbeatAt: finishedAt
        }
      });

      if (updated.count === 0) {
        await this.prisma.importBatchCollectionLock.deleteMany({
          where: {
            jobId: input.jobId
          }
        });
        return;
      }
    }

    await this.prisma.importBatchCollectionLock.deleteMany({
      where: {
        jobId: input.jobId
      }
    });
    this.auditPublisher.publish({
      kind: 'IMPORT_BATCH_COLLECTION_JOB',
      eventName: 'import_batch_collection_job.finished',
      occurredAt: finishedAt.toISOString(),
      tenantId: input.tenantId,
      ledgerId: input.ledgerId,
      resourceType: 'import-batch-collection-job',
      resourceId: input.jobId,
      result:
        input.status === ImportBatchCollectionJobStatus.SUCCEEDED
          ? 'SUCCESS'
          : 'FAILED',
      payload: {
        importBatchId: input.importBatchId,
        requestedRowCount: input.requestedRowCount,
        processedRowCount: input.processedRowCount,
        succeededCount: input.succeededCount,
        failedCount: input.failedCount,
        status: input.status,
        errorMessage: input.errorMessage
      }
    });
  }

  private async isJobCancelled(jobId: string): Promise<boolean> {
    const job = await this.prisma.importBatchCollectionJob.findFirst({
      where: {
        id: jobId
      },
      select: {
        status: true
      }
    });

    return job?.status === ImportBatchCollectionJobStatus.CANCELLED;
  }
}

function readCollectionJobSuccessMessage(autoPreparation: {
  willCreateTargetPeriod?: boolean;
  targetPeriodMonthLabel?: string;
  targetPeriodCreationReason?: 'INITIAL_SETUP' | 'NEW_FUNDING_ACCOUNT';
  decisionReasons: string[];
}): string | null {
  if (
    autoPreparation.willCreateTargetPeriod &&
    autoPreparation.targetPeriodMonthLabel
  ) {
    if (autoPreparation.targetPeriodCreationReason === 'NEW_FUNDING_ACCOUNT') {
      return `${autoPreparation.targetPeriodMonthLabel} 신규 계좌/카드 기초 업로드로 운영월을 자동 생성하고 등록했습니다.`;
    }

    if (autoPreparation.targetPeriodCreationReason === 'INITIAL_SETUP') {
      return `${autoPreparation.targetPeriodMonthLabel} 운영 시작 전 기초 입력으로 운영월을 자동 생성하고 등록했습니다.`;
    }
  }

  return autoPreparation.decisionReasons.at(-1) ?? null;
}

function readBulkCollectRequest(
  value: Prisma.JsonValue
): BulkCollectImportedRowsRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('일괄 등록 요청 정보를 읽을 수 없습니다.');
  }

  const record = value as Record<string, unknown>;
  if (typeof record.fundingAccountId !== 'string') {
    throw new Error('일괄 등록 요청 계좌/카드 정보를 읽을 수 없습니다.');
  }
  const type =
    typeof record.type === 'string' && isCollectedTransactionType(record.type)
      ? record.type
      : undefined;
  const typeOptions = readBulkCollectTypeOptions(record.typeOptions);

  return {
    ...(Array.isArray(record.rowIds)
      ? {
          rowIds: record.rowIds.filter(
            (rowId): rowId is string => typeof rowId === 'string'
          )
        }
      : {}),
    ...(type ? { type } : {}),
    fundingAccountId: record.fundingAccountId,
    ...(typeof record.categoryId === 'string'
      ? { categoryId: record.categoryId }
      : {}),
    ...(typeof record.memo === 'string' ? { memo: record.memo } : {}),
    ...(typeOptions.length > 0 ? { typeOptions } : {})
  };
}

function readBulkCollectTypeOptions(
  value: unknown
): BulkCollectImportedRowsTypeOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) {
      return [];
    }

    const record = option as Record<string, unknown>;
    if (
      typeof record.type !== 'string' ||
      !isCollectedTransactionType(record.type)
    ) {
      return [];
    }

    const categoryId =
      typeof record.categoryId === 'string' ? record.categoryId : undefined;
    const memo = typeof record.memo === 'string' ? record.memo : undefined;

    if (!categoryId && !memo) {
      return [];
    }

    return [
      {
        type: record.type,
        ...(categoryId ? { categoryId } : {}),
        ...(memo ? { memo } : {})
      }
    ];
  });
}

function resolveFinalJobStatus(input: {
  succeededCount: number;
  failedCount: number;
}): ImportBatchCollectionJobStatus {
  if (input.failedCount > 0 && input.succeededCount > 0) {
    return ImportBatchCollectionJobStatus.PARTIAL;
  }

  if (input.failedCount > 0) {
    return ImportBatchCollectionJobStatus.FAILED;
  }

  return ImportBatchCollectionJobStatus.SUCCEEDED;
}

function shouldFlushJobProgress(input: {
  processedRowCount: number;
  lastRowStatus: ImportBatchCollectionJobRowStatus;
  lastProgressFlushedAt: Date;
  checkedAt: Date;
}) {
  if (input.lastRowStatus === ImportBatchCollectionJobRowStatus.FAILED) {
    return true;
  }

  if (input.processedRowCount % JOB_PROGRESS_FLUSH_ROW_INTERVAL === 0) {
    return true;
  }

  return (
    input.checkedAt.getTime() - input.lastProgressFlushedAt.getTime() >=
    JOB_PROGRESS_FLUSH_INTERVAL_MS
  );
}

function isCollectedTransactionType(
  value: string
): value is CollectedTransactionType {
  return (
    value === 'INCOME' ||
    value === 'EXPENSE' ||
    value === 'TRANSFER' ||
    value === 'REVERSAL'
  );
}
