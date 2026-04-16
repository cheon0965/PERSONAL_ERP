import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CreateOperationsExportRequest,
  CreateOperationsNoteRequest,
  OperationsAlertItem,
  OperationsAlertsResponse,
  OperationsChecklistGroup,
  OperationsChecklistItem,
  OperationsChecklistResponse,
  OperationsExceptionsResponse,
  OperationsExportResult,
  OperationsExportScope,
  OperationsExportScopeItem,
  OperationsExportsResponse,
  OperationsHubSummary,
  OperationsImportBatchStatusItem,
  OperationsImportStatusSummary,
  OperationsMonthEndSummary,
  OperationsNoteItem,
  OperationsNotesResponse,
  OperationsReadinessStatus,
  OperationsSystemComponentItem,
  OperationsSystemComponentStatus,
  OperationsSystemStatusSummary
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  ImportedRowParseStatus,
  OperationalNoteKind,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import { fromPrismaMoneyWon } from '../../common/money/prisma-money';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getApiEnv } from '../../config/api-env';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import { OperationsConsoleReadRepository } from './operations-console-read.repository';

const openPeriodStatuses: readonly AccountingPeriodStatus[] = [
  AccountingPeriodStatus.OPEN,
  AccountingPeriodStatus.IN_REVIEW,
  AccountingPeriodStatus.CLOSING
] as const;

const unresolvedTransactionStatuses = [
  CollectedTransactionStatus.COLLECTED,
  CollectedTransactionStatus.REVIEWED,
  CollectedTransactionStatus.READY_TO_POST
] as const;

const exportScopes: readonly OperationsExportScope[] = [
  'REFERENCE_DATA',
  'COLLECTED_TRANSACTIONS',
  'JOURNAL_ENTRIES',
  'FINANCIAL_STATEMENTS'
] as const;

const operationsPeriodInclude =
  Prisma.validator<Prisma.AccountingPeriodInclude>()({
    openingBalanceSnapshot: {
      select: {
        sourceKind: true
      }
    },
    statusHistory: {
      orderBy: {
        changedAt: 'desc'
      },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        eventType: true,
        reason: true,
        actorType: true,
        actorMembershipId: true,
        changedAt: true
      }
    }
  });

type ReferenceReadinessGap = {
  key: string;
  label: string;
  href: string;
};

type ImportRowSnapshot = {
  parseStatus: ImportedRowParseStatus;
  createdCollectedTransaction?: { id: string } | null;
};

type ImportBatchSnapshot = {
  id: string;
  sourceKind: OperationsImportBatchStatusItem['sourceKind'];
  fileName: string;
  rowCount: number;
  parseStatus: OperationsImportBatchStatusItem['parseStatus'];
  uploadedAt: Date;
  rows: ImportRowSnapshot[];
};

type OperationsSnapshot = {
  generatedAt: string;
  currentPeriod: AccountingPeriodItem | null;
  readinessGaps: ReferenceReadinessGap[];
  unresolvedTransactions: Array<{
    id: string;
    title: string;
    status: CollectedTransactionStatus;
    occurredOn: Date;
  }>;
  importBatches: ImportBatchSnapshot[];
  remainingPlanItems: Array<{
    id: string;
    plannedAmount: Prisma.Decimal | number;
  }>;
  financialStatementSnapshotCount: number;
  carryForwardCreated: boolean;
  failedAuditEvents: Array<{
    id: string;
    eventName: string;
    requestId: string | null;
    occurredAt: Date;
  }>;
  successfulAuditEvents: Array<{
    id: string;
    eventName: string;
    requestId: string | null;
    occurredAt: Date;
  }>;
  deniedAuditEvents: Array<{
    id: string;
    eventName: string;
    action: string | null;
    requestId: string | null;
    occurredAt: Date;
  }>;
};

type ExportPeriodRecord = {
  id: string;
  year: number;
  month: number;
};

type BuildExportPayloadInput = {
  scope: OperationsExportScope;
  tenantId: string;
  ledgerId: string;
  periodId: string | null;
  rangeLabel: string;
};

type BuildExportPayloadResult = {
  rowCount: number;
  rangeLabel: string;
  payload: string;
};

type CsvCell = string | number | boolean | Date | null | undefined;
type CsvRow = CsvCell[];

type OperationalNoteRecord = {
  id: string;
  kind: OperationalNoteKind;
  title: string;
  body: string;
  relatedHref: string | null;
  periodId: string | null;
  authorMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
  period?: {
    year: number;
    month: number;
  } | null;
};

@Injectable()
export class OperationsConsoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationsConsoleReadRepository: OperationsConsoleReadRepository
  ) {}

  async getHubSummary(user: AuthenticatedUser): Promise<OperationsHubSummary> {
    const snapshot = await this.buildSnapshot(user);
    const checklist = this.buildChecklist(snapshot);
    const exceptions = this.buildExceptions(snapshot);
    const monthEnd = this.buildMonthEndSummary(snapshot);
    const imports = this.buildImportStatus(snapshot);

    return {
      generatedAt: snapshot.generatedAt,
      checklist,
      exceptions,
      monthEnd,
      imports,
      outstandingWorkCount:
        exceptions.totalCount + checklist.totals.actionRequired + checklist.totals.blocked
    };
  }

  async getChecklist(
    user: AuthenticatedUser
  ): Promise<OperationsChecklistResponse> {
    return this.buildChecklist(await this.buildSnapshot(user));
  }

  async getExceptions(
    user: AuthenticatedUser
  ): Promise<OperationsExceptionsResponse> {
    return this.buildExceptions(await this.buildSnapshot(user));
  }

  async getMonthEndSummary(
    user: AuthenticatedUser
  ): Promise<OperationsMonthEndSummary> {
    return this.buildMonthEndSummary(await this.buildSnapshot(user));
  }

  async getImportStatus(
    user: AuthenticatedUser
  ): Promise<OperationsImportStatusSummary> {
    return this.buildImportStatus(await this.buildSnapshot(user));
  }

  async getSystemStatus(
    user: AuthenticatedUser
  ): Promise<OperationsSystemStatusSummary> {
    return this.buildSystemStatus(await this.buildSnapshot(user));
  }

  async getAlerts(user: AuthenticatedUser): Promise<OperationsAlertsResponse> {
    return this.buildAlerts(await this.buildSnapshot(user));
  }


  private async buildSnapshot(user: AuthenticatedUser): Promise<OperationsSnapshot> {
    const workspace = requireCurrentWorkspace(user);
    return this.operationsConsoleReadRepository.readSnapshot({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    });
  }

  private buildChecklist(
    snapshot: OperationsSnapshot
  ): OperationsChecklistResponse {
    const unresolvedCount = snapshot.unresolvedTransactions.length;
    const importStatus = this.buildImportStatus(snapshot);
    const monthEnd = this.buildMonthEndSummary(snapshot);
    const hasPeriod = Boolean(snapshot.currentPeriod);
    const hasOpeningSnapshot =
      snapshot.currentPeriod?.hasOpeningBalanceSnapshot ?? false;

    const groups: OperationsChecklistGroup[] = [
      {
        key: 'MONTH_START',
        title: '월 시작 전',
        description: '월 운영을 시작하기 전에 기준 데이터와 운영 기간을 확인합니다.',
        items: [
          this.createChecklistItem({
            id: 'reference-data-ready',
            title: '기준 데이터 준비',
            description: '자금수단, 카테고리, 계정과목, 거래유형이 준비되어야 합니다.',
            status:
              snapshot.readinessGaps.length === 0 ? 'READY' : 'ACTION_REQUIRED',
            detail:
              snapshot.readinessGaps.length === 0
                ? '필수 기준 데이터가 준비되어 있습니다.'
                : `${snapshot.readinessGaps.length}개 기준 데이터가 부족합니다.`,
            blockingReason:
              snapshot.readinessGaps.length > 0
                ? snapshot.readinessGaps.map((gap) => gap.label).join(', ')
                : null,
            actionLabel: '기준 데이터 확인',
            href: '/reference-data'
          }),
          this.createChecklistItem({
            id: 'current-period-ready',
            title: '현재 운영 기간',
            description: '거래 수집과 월 마감을 위한 운영 기간이 필요합니다.',
            status: hasPeriod ? 'READY' : 'BLOCKED',
            detail: hasPeriod
              ? `${snapshot.currentPeriod?.monthLabel} 기간을 기준으로 운영합니다.`
              : '아직 열린 운영 기간이 없습니다.',
            blockingReason: hasPeriod ? null : '월 운영 화면에서 운영 기간을 먼저 열어야 합니다.',
            actionLabel: '월 운영 보기',
            href: '/periods'
          }),
          this.createChecklistItem({
            id: 'opening-balance-ready',
            title: '기초 잔액 스냅샷',
            description: '현재 기간의 장부 시작 기준이 준비되어 있는지 확인합니다.',
            status: !hasPeriod ? 'BLOCKED' : hasOpeningSnapshot ? 'READY' : 'ACTION_REQUIRED',
            detail: hasOpeningSnapshot
              ? '현재 기간에 기초 잔액 스냅샷이 연결되어 있습니다.'
              : '기초 잔액 스냅샷이 아직 없습니다.',
            blockingReason: !hasPeriod ? '운영 기간이 먼저 필요합니다.' : null,
            actionLabel: '월 운영 보기',
            href: '/periods'
          })
        ]
      },
      {
        key: 'DAILY',
        title: '일일 점검',
        description: '매일 처리할 수집 거래와 업로드 예외를 확인합니다.',
        items: [
          this.createChecklistItem({
            id: 'unresolved-transactions',
            title: '미확정 수집 거래',
            description: '전표로 확정되지 않은 수집 거래를 확인합니다.',
            status: unresolvedCount === 0 ? 'READY' : 'ACTION_REQUIRED',
            detail:
              unresolvedCount === 0
                ? '처리 대기 중인 수집 거래가 없습니다.'
                : `${unresolvedCount}건의 수집 거래가 확정 전 상태입니다.`,
            blockingReason: null,
            actionLabel: '수집 거래 보기',
            href: '/transactions'
          }),
          this.createChecklistItem({
            id: 'import-row-backlog',
            title: '업로드 미수집 행',
            description: '정상 파싱됐지만 아직 수집 거래로 승격되지 않은 행을 처리합니다.',
            status:
              importStatus.uncollectedRowCount === 0
                ? 'READY'
                : 'ACTION_REQUIRED',
            detail:
              importStatus.uncollectedRowCount === 0
                ? '수집 대기 중인 업로드 행이 없습니다.'
                : `${importStatus.uncollectedRowCount}개 행이 수집 대기 중입니다.`,
            blockingReason: null,
            actionLabel: '업로드 보기',
            href: '/imports'
          }),
          this.createChecklistItem({
            id: 'failed-audit-events',
            title: '최근 실패 이벤트',
            description: '운영 API 실패나 보안 이벤트 실패가 반복되는지 확인합니다.',
            status:
              snapshot.failedAuditEvents.length === 0
                ? 'READY'
                : 'ACTION_REQUIRED',
            detail:
              snapshot.failedAuditEvents.length === 0
                ? '최근 실패한 운영 이벤트가 없습니다.'
                : `${snapshot.failedAuditEvents.length}건의 실패 이벤트가 있습니다.`,
            blockingReason: null,
            actionLabel: '감사 로그 보기',
            href: '/admin/logs'
          })
        ]
      },
      {
        key: 'MONTH_END',
        title: '월 마감 전',
        description: '마감 차단 사유와 공식 산출물 생성 상태를 점검합니다.',
        items: [
          this.createChecklistItem({
            id: 'month-close-readiness',
            title: '마감 가능 상태',
            description: '미확정 거래와 필수 기준 데이터가 남아 있는지 확인합니다.',
            status: monthEnd.closeReadiness,
            detail: monthEnd.closeReadinessLabel,
            blockingReason:
              monthEnd.blockers.length > 0 ? monthEnd.blockers.join(' / ') : null,
            actionLabel: '월 마감 대시보드',
            href: '/operations/month-end'
          }),
          this.createChecklistItem({
            id: 'financial-statements-ready',
            title: '재무제표 스냅샷',
            description: '잠금된 기간에는 공식 재무제표 스냅샷이 있어야 합니다.',
            status:
              snapshot.currentPeriod?.status === 'LOCKED' &&
              snapshot.financialStatementSnapshotCount === 0
                ? 'ACTION_REQUIRED'
                : 'INFO',
            detail:
              snapshot.financialStatementSnapshotCount > 0
                ? `${snapshot.financialStatementSnapshotCount}개 재무제표 스냅샷이 있습니다.`
                : '마감 후 재무제표 스냅샷 생성 상태를 확인합니다.',
            blockingReason: null,
            actionLabel: '재무제표 보기',
            href: '/financial-statements'
          }),
          this.createChecklistItem({
            id: 'carry-forward-ready',
            title: '차기 이월',
            description: '잠금된 기간의 다음 월 기초 잔액 연결 상태를 확인합니다.',
            status:
              snapshot.currentPeriod?.status === 'LOCKED' &&
              !snapshot.carryForwardCreated
                ? 'ACTION_REQUIRED'
                : 'INFO',
            detail: snapshot.carryForwardCreated
              ? '차기 이월 기록이 생성되어 있습니다.'
              : '마감 후 차기 이월 생성 여부를 확인합니다.',
            blockingReason: null,
            actionLabel: '차기 이월 보기',
            href: '/carry-forwards'
          })
        ]
      },
      {
        key: 'DEPLOY',
        title: '배포/운영 점검',
        description: '배포 전후 운영자가 빠르게 확인할 위험 신호입니다.',
        items: [
          this.createChecklistItem({
            id: 'operations-exceptions-clean',
            title: '예외 처리함 확인',
            description: '운영자가 당장 처리할 예외가 남아 있는지 확인합니다.',
            status:
              monthEnd.blockers.length === 0 &&
              importStatus.failedRowCount === 0 &&
              unresolvedCount === 0
                ? 'READY'
                : 'ACTION_REQUIRED',
            detail: `${monthEnd.blockers.length + importStatus.failedRowCount + unresolvedCount}개 위험 신호를 확인해야 합니다.`,
            blockingReason: null,
            actionLabel: '예외 처리함 보기',
            href: '/operations/exceptions'
          })
        ]
      }
    ];

    const items = groups.flatMap((group) => group.items);

    return {
      generatedAt: snapshot.generatedAt,
      currentPeriod: snapshot.currentPeriod,
      totals: {
        ready: items.filter((item) => item.status === 'READY').length,
        actionRequired: items.filter((item) => item.status === 'ACTION_REQUIRED').length,
        blocked: items.filter((item) => item.status === 'BLOCKED').length
      },
      groups
    };
  }

  private buildExceptions(
    snapshot: OperationsSnapshot
  ): OperationsExceptionsResponse {
    const importStatus = this.buildImportStatus(snapshot);
    const monthEnd = this.buildMonthEndSummary(snapshot);
    const items: OperationsExceptionsResponse['items'] = [];

    if (snapshot.readinessGaps.length > 0) {
      items.push({
        id: 'reference-data-gaps',
        kind: 'REFERENCE_DATA',
        severity: 'CRITICAL',
        title: '기준 데이터 준비 부족',
        description: snapshot.readinessGaps.map((gap) => gap.label).join(', '),
        count: snapshot.readinessGaps.length,
        primaryActionLabel: '기준 데이터 확인',
        href: '/reference-data',
        lastOccurredAt: null
      });
    }

    if (snapshot.unresolvedTransactions.length > 0) {
      items.push({
        id: 'unresolved-collected-transactions',
        kind: 'COLLECTED_TRANSACTION',
        severity: 'WARNING',
        title: '미확정 수집 거래',
        description: '전표 확정 전 상태의 수집 거래가 남아 있습니다.',
        count: snapshot.unresolvedTransactions.length,
        primaryActionLabel: '수집 거래 처리',
        href: '/transactions',
        lastOccurredAt:
          snapshot.unresolvedTransactions[0]?.occurredOn.toISOString() ?? null
      });
    }

    if (importStatus.failedRowCount > 0) {
      items.push({
        id: 'failed-import-rows',
        kind: 'IMPORT_ROW',
        severity: 'WARNING',
        title: '업로드 파싱 실패 행',
        description: '업로드 원본 중 파싱에 실패한 행이 있습니다.',
        count: importStatus.failedRowCount,
        primaryActionLabel: '업로드 확인',
        href: '/operations/imports',
        lastOccurredAt: importStatus.latestUploadedAt
      });
    }

    if (importStatus.uncollectedRowCount > 0) {
      items.push({
        id: 'uncollected-import-rows',
        kind: 'IMPORT_ROW',
        severity: 'WARNING',
        title: '업로드 미수집 행',
        description: '정상 파싱됐지만 아직 수집 거래로 승격되지 않은 행입니다.',
        count: importStatus.uncollectedRowCount,
        primaryActionLabel: '업로드 행 수집',
        href: '/imports',
        lastOccurredAt: importStatus.latestUploadedAt
      });
    }

    if (monthEnd.blockers.length > 0) {
      items.push({
        id: 'month-close-blockers',
        kind: 'MONTH_CLOSE',
        severity: 'CRITICAL',
        title: '월 마감 차단 사유',
        description: monthEnd.blockers.join(' / '),
        count: monthEnd.blockers.length,
        primaryActionLabel: '월 마감 대시보드',
        href: '/operations/month-end',
        lastOccurredAt: null
      });
    }

    if (snapshot.failedAuditEvents.length > 0) {
      items.push({
        id: 'failed-audit-events',
        kind: 'AUDIT_EVENT',
        severity: 'WARNING',
        title: '최근 실패한 운영 이벤트',
        description: snapshot.failedAuditEvents[0]?.eventName ?? '실패 이벤트',
        count: snapshot.failedAuditEvents.length,
        primaryActionLabel: '감사 로그 확인',
        href: '/admin/logs',
        lastOccurredAt:
          snapshot.failedAuditEvents[0]?.occurredAt.toISOString() ?? null
      });
    }

    return {
      generatedAt: snapshot.generatedAt,
      totalCount: items.reduce((sum, item) => sum + item.count, 0),
      criticalCount: items
        .filter((item) => item.severity === 'CRITICAL')
        .reduce((sum, item) => sum + item.count, 0),
      warningCount: items
        .filter((item) => item.severity === 'WARNING')
        .reduce((sum, item) => sum + item.count, 0),
      items
    };
  }

  private buildMonthEndSummary(
    snapshot: OperationsSnapshot
  ): OperationsMonthEndSummary {
    const importStatus = this.buildImportStatus(snapshot);
    const blockers: string[] = [];
    const warnings: string[] = [];
    const remainingPlannedExpenseWon = snapshot.remainingPlanItems.reduce(
      (sum, item) => sum + fromPrismaMoneyWon(item.plannedAmount),
      0
    );

    if (!snapshot.currentPeriod) {
      blockers.push('현재 운영 기간이 없습니다.');
    }

    if (snapshot.readinessGaps.length > 0) {
      blockers.push(`기준 데이터 ${snapshot.readinessGaps.length}개가 부족합니다.`);
    }

    if (snapshot.unresolvedTransactions.length > 0) {
      blockers.push(`미확정 수집 거래 ${snapshot.unresolvedTransactions.length}건이 남아 있습니다.`);
    }

    if (importStatus.failedRowCount > 0) {
      warnings.push(`업로드 파싱 실패 행 ${importStatus.failedRowCount}개를 확인해야 합니다.`);
    }

    if (snapshot.remainingPlanItems.length > 0) {
      warnings.push(`남은 계획 항목 ${snapshot.remainingPlanItems.length}건을 확인해야 합니다.`);
    }

    if (
      snapshot.currentPeriod?.status === 'LOCKED' &&
      snapshot.financialStatementSnapshotCount === 0
    ) {
      warnings.push('잠금된 기간의 재무제표 스냅샷이 아직 없습니다.');
    }

    if (
      snapshot.currentPeriod?.status === 'LOCKED' &&
      !snapshot.carryForwardCreated
    ) {
      warnings.push('잠금된 기간의 차기 이월 기록이 아직 없습니다.');
    }

    const closeReadiness: OperationsReadinessStatus =
      blockers.length > 0
        ? 'BLOCKED'
        : warnings.length > 0
          ? 'ACTION_REQUIRED'
          : 'READY';

    return {
      generatedAt: snapshot.generatedAt,
      period: snapshot.currentPeriod,
      periodStatus: snapshot.currentPeriod?.status ?? null,
      closeReadiness,
      closeReadinessLabel: readCloseReadinessLabel(closeReadiness),
      unresolvedTransactionCount: snapshot.unresolvedTransactions.length,
      failedImportRowCount: importStatus.failedRowCount,
      remainingPlanItemCount: snapshot.remainingPlanItems.length,
      remainingPlannedExpenseWon,
      financialStatementSnapshotCount: snapshot.financialStatementSnapshotCount,
      carryForwardCreated: snapshot.carryForwardCreated,
      blockers,
      warnings
    };
  }

  private buildImportStatus(
    snapshot: OperationsSnapshot
  ): OperationsImportStatusSummary {
    const batches = snapshot.importBatches.map((batch) =>
      this.mapImportBatchStatus(batch)
    );
    const parsedRowCount = batches.reduce(
      (sum, batch) => sum + batch.parsedRowCount,
      0
    );
    const collectedRowCount = batches.reduce(
      (sum, batch) => sum + (batch.parsedRowCount - batch.uncollectedRowCount),
      0
    );

    return {
      generatedAt: snapshot.generatedAt,
      totalBatchCount: batches.length,
      totalRowCount: batches.reduce((sum, batch) => sum + batch.rowCount, 0),
      failedRowCount: batches.reduce((sum, batch) => sum + batch.failedRowCount, 0),
      uncollectedRowCount: batches.reduce(
        (sum, batch) => sum + batch.uncollectedRowCount,
        0
      ),
      collectedRowCount,
      collectionRate: calculateRate(collectedRowCount, parsedRowCount),
      latestUploadedAt: batches[0]?.uploadedAt ?? null,
      batches: batches.slice(0, 12)
    };
  }

  private async buildSystemStatus(
    snapshot: OperationsSnapshot
  ): Promise<OperationsSystemStatusSummary> {
    const generatedAt = new Date().toISOString();
    const databaseStatus = await this.checkDatabaseStatus(generatedAt);
    const env = getApiEnv();
    const lastEmailBoundaryEventAt = readLatestDate([
      ...snapshot.failedAuditEvents.filter((event) =>
        event.eventName.includes('email')
      ),
      ...snapshot.successfulAuditEvents.filter((event) =>
        event.eventName.includes('email')
      )
    ]);
    const mailStatus = readMailStatus({
      provider: env.MAIL_PROVIDER,
      lastBoundaryEventAt: lastEmailBoundaryEventAt
    });
    const recentFailureStatus: OperationsSystemComponentStatus =
      snapshot.failedAuditEvents.length > 0 ? 'DEGRADED' : 'OPERATIONAL';
    const components = [
      {
        key: 'api',
        label: 'API 프로세스',
        status: 'OPERATIONAL' as const,
        detail: '운영 콘솔 API가 응답하고 있습니다.',
        lastCheckedAt: generatedAt
      },
      databaseStatus,
      {
        key: 'audit-events',
        label: '감사 로그',
        status: recentFailureStatus,
        detail:
          snapshot.failedAuditEvents.length === 0
            ? '최근 실패 이벤트가 없습니다.'
            : `최근 실패 이벤트 ${snapshot.failedAuditEvents.length}건을 확인해야 합니다.`,
        lastCheckedAt: generatedAt
      },
      {
        key: 'mail',
        label: '메일 발송 경계',
        status: mailStatus.status,
        detail: mailStatus.detail,
        lastCheckedAt: generatedAt
      }
    ];
    const overallStatus = readOverallStatus(components.map((item) => item.status));

    return {
      generatedAt,
      overallStatus,
      components,
      build: {
        environment: process.env.NODE_ENV ?? 'development',
        nodeVersion: process.version,
        appVersion: process.env.APP_VERSION ?? 'local',
        commitSha:
          process.env.VERCEL_GIT_COMMIT_SHA ??
          process.env.GIT_COMMIT_SHA ??
          process.env.COMMIT_SHA ??
          null,
        uptimeSeconds: Math.round(process.uptime())
      },
      recentActivity: {
        lastSuccessfulAuditEventAt:
          snapshot.successfulAuditEvents[0]?.occurredAt.toISOString() ?? null,
        lastFailedAuditEventAt:
          snapshot.failedAuditEvents[0]?.occurredAt.toISOString() ?? null,
        lastImportUploadedAt:
          snapshot.importBatches[0]?.uploadedAt.toISOString() ?? null,
        lastEmailBoundaryEventAt
      },
      mail: mailStatus
    };
  }

  private buildAlerts(snapshot: OperationsSnapshot): OperationsAlertsResponse {
    const exceptions = this.buildExceptions(snapshot);
    const alerts: OperationsAlertItem[] = exceptions.items.map((item) => ({
      id: `exception-${item.id}`,
      kind: mapExceptionKindToAlertKind(item.kind),
      severity: item.severity,
      title: item.title,
      description: item.description,
      actionLabel: item.primaryActionLabel,
      href: item.href,
      sourceAuditEventId: null,
      requestId: null,
      createdAt: item.lastOccurredAt ?? snapshot.generatedAt
    }));

    for (const event of snapshot.failedAuditEvents) {
      alerts.push({
        id: `failed-audit-${event.id}`,
        kind: event.eventName.includes('email') ? 'SYSTEM' : 'SECURITY',
        severity: event.eventName.includes('email') ? 'CRITICAL' : 'WARNING',
        title: event.eventName.includes('email')
          ? '메일 발송 실패'
          : '운영 이벤트 실패',
        description: event.eventName,
        actionLabel: '감사 로그 확인',
        href: event.requestId
          ? `/admin/logs?requestId=${encodeURIComponent(event.requestId)}`
          : '/admin/logs',
        sourceAuditEventId: event.id,
        requestId: event.requestId,
        createdAt: event.occurredAt.toISOString()
      });
    }

    for (const event of snapshot.deniedAuditEvents) {
      alerts.push({
        id: `denied-audit-${event.id}`,
        kind: 'SECURITY',
        severity: 'WARNING',
        title: '권한 거부 이벤트',
        description: event.action
          ? `${event.action} 작업이 거부되었습니다.`
          : event.eventName,
        actionLabel: '권한 로그 확인',
        href: event.requestId
          ? `/admin/logs?requestId=${encodeURIComponent(event.requestId)}`
          : '/admin/logs',
        sourceAuditEventId: event.id,
        requestId: event.requestId,
        createdAt: event.occurredAt.toISOString()
      });
    }

    const dedupedAlerts = dedupeAlerts(alerts).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );

    return {
      generatedAt: snapshot.generatedAt,
      totalCount: dedupedAlerts.length,
      criticalCount: dedupedAlerts.filter(
        (item) => item.severity === 'CRITICAL'
      ).length,
      warningCount: dedupedAlerts.filter((item) => item.severity === 'WARNING')
        .length,
      items: dedupedAlerts.slice(0, 20)
    };
  }

  private mapImportBatchStatus(
    batch: ImportBatchSnapshot
  ): OperationsImportBatchStatusItem {
    const parsedRowCount = batch.rows.filter(
      (row) => row.parseStatus === ImportedRowParseStatus.PARSED
    ).length;
    const failedRowCount = batch.rows.filter(
      (row) => row.parseStatus === ImportedRowParseStatus.FAILED
    ).length;
    const uncollectedRowCount = batch.rows.filter(
      (row) =>
        row.parseStatus === ImportedRowParseStatus.PARSED &&
        !row.createdCollectedTransaction
    ).length;

    return {
      id: batch.id,
      fileName: batch.fileName,
      sourceKind: batch.sourceKind,
      parseStatus: batch.parseStatus,
      uploadedAt: batch.uploadedAt.toISOString(),
      rowCount: batch.rowCount,
      parsedRowCount,
      failedRowCount,
      uncollectedRowCount,
      collectionRate: calculateRate(
        parsedRowCount - uncollectedRowCount,
        parsedRowCount
      )
    };
  }

  private createChecklistItem(
    item: OperationsChecklistItem
  ): OperationsChecklistItem {
    return item;
  }

  private async checkDatabaseStatus(
    checkedAt: string
  ): Promise<OperationsSystemComponentItem> {
    return this.operationsConsoleReadRepository.readDatabaseStatus(checkedAt);
  }
}

function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 1000;
}

function readCloseReadinessLabel(status: OperationsReadinessStatus): string {
  switch (status) {
    case 'READY':
      return '마감 전 필수 차단 사유가 없습니다.';
    case 'ACTION_REQUIRED':
      return '마감 전 확인할 경고가 남아 있습니다.';
    case 'BLOCKED':
      return '마감 전에 반드시 처리해야 할 차단 사유가 있습니다.';
    default:
      return '운영 참고 상태입니다.';
  }
}

function readMailStatus(input: {
  provider: 'console' | 'gmail-api';
  lastBoundaryEventAt: string | null;
}) {
  const isConsole = input.provider === 'console';

  return {
    provider: input.provider,
    status: 'OPERATIONAL' as const,
    detail: isConsole
      ? '콘솔 메일 어댑터를 사용합니다. 운영 발송 전 실제 제공자 전환이 필요할 수 있습니다.'
      : 'Gmail API 메일 어댑터가 환경 설정 검증을 통과했습니다.',
    lastBoundaryEventAt: input.lastBoundaryEventAt
  };
}

function readOverallStatus(
  statuses: OperationsSystemComponentStatus[]
): OperationsSystemComponentStatus {
  if (statuses.includes('DOWN')) {
    return 'DOWN';
  }

  if (statuses.includes('DEGRADED')) {
    return 'DEGRADED';
  }

  if (statuses.includes('UNKNOWN')) {
    return 'UNKNOWN';
  }

  return 'OPERATIONAL';
}

function readLatestDate(events: Array<{ occurredAt: Date }>): string | null {
  const latest = events
    .map((event) => event.occurredAt)
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latest?.toISOString() ?? null;
}

function mapExceptionKindToAlertKind(
  kind: OperationsExceptionsResponse['items'][number]['kind']
): OperationsAlertItem['kind'] {
  switch (kind) {
    case 'REFERENCE_DATA':
      return 'REFERENCE_DATA';
    case 'IMPORT_ROW':
      return 'IMPORT';
    case 'MONTH_CLOSE':
    case 'COLLECTED_TRANSACTION':
      return 'MONTH_CLOSE';
    case 'AUDIT_EVENT':
    default:
      return 'SECURITY';
  }
}

function dedupeAlerts(alerts: OperationsAlertItem[]): OperationsAlertItem[] {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = `${alert.kind}:${alert.title}:${alert.sourceAuditEventId ?? alert.description}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

type ExportSourceCollections = {
  accounts: Array<{ updatedAt?: Date }>;
  categories: Array<{ updatedAt?: Date }>;
  accountSubjects: Array<{ updatedAt?: Date }>;
  ledgerTransactionTypes: Array<{ updatedAt?: Date }>;
  collectedTransactions: Array<{ occurredOn?: Date; updatedAt?: Date }>;
  journalEntries: Array<{ entryDate?: Date; createdAt?: Date; updatedAt?: Date }>;
  financialStatementSnapshots: Array<{ createdAt?: Date; updatedAt?: Date }>;
};

function readExportRowCount(
  scope: OperationsExportScope,
  sources: ExportSourceCollections
): number {
  switch (scope) {
    case 'REFERENCE_DATA':
      return (
        sources.accounts.length +
        sources.categories.length +
        sources.accountSubjects.length +
        sources.ledgerTransactionTypes.length
      );
    case 'COLLECTED_TRANSACTIONS':
      return sources.collectedTransactions.length;
    case 'JOURNAL_ENTRIES':
      return sources.journalEntries.length;
    case 'FINANCIAL_STATEMENTS':
      return sources.financialStatementSnapshots.length;
    default:
      return 0;
  }
}

function readExportSourceDates(
  scope: OperationsExportScope,
  sources: ExportSourceCollections
): Array<Date | undefined> {
  switch (scope) {
    case 'REFERENCE_DATA':
      return [
        ...sources.accounts.map((item) => item.updatedAt),
        ...sources.categories.map((item) => item.updatedAt),
        ...sources.accountSubjects.map((item) => item.updatedAt),
        ...sources.ledgerTransactionTypes.map((item) => item.updatedAt)
      ];
    case 'COLLECTED_TRANSACTIONS':
      return sources.collectedTransactions.flatMap((item) => [
        item.occurredOn,
        item.updatedAt
      ]);
    case 'JOURNAL_ENTRIES':
      return sources.journalEntries.flatMap((item) => [
        item.entryDate,
        item.createdAt,
        item.updatedAt
      ]);
    case 'FINANCIAL_STATEMENTS':
      return sources.financialStatementSnapshots.flatMap((item) => [
        item.createdAt,
        item.updatedAt
      ]);
    default:
      return [];
  }
}

function readExportScopeLabel(scope: OperationsExportScope): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '기준 데이터';
    case 'COLLECTED_TRANSACTIONS':
      return '수집 거래';
    case 'JOURNAL_ENTRIES':
      return '전표';
    case 'FINANCIAL_STATEMENTS':
      return '재무제표 스냅샷';
    default:
      return scope;
  }
}

function readExportScopeDescription(scope: OperationsExportScope): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '자금수단, 카테고리, 계정과목, 거래유형을 한 번에 CSV로 반출합니다.';
    case 'COLLECTED_TRANSACTIONS':
      return '수집 거래의 상태, 금액, 업로드 연결 정보를 CSV로 반출합니다.';
    case 'JOURNAL_ENTRIES':
      return '전표 헤더와 라인을 한 행 단위 CSV로 반출합니다.';
    case 'FINANCIAL_STATEMENTS':
      return '생성된 재무제표 스냅샷 payload를 감사용 CSV로 반출합니다.';
    default:
      return '운영 데이터를 CSV로 반출합니다.';
  }
}

function readExportScopeCadence(scope: OperationsExportScope): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '기준 데이터 변경 후';
    case 'COLLECTED_TRANSACTIONS':
    case 'JOURNAL_ENTRIES':
      return '월 마감 전/후';
    case 'FINANCIAL_STATEMENTS':
      return '재무제표 생성 직후';
    default:
      return '필요 시';
  }
}

function readScopeRangeLabel(scope: OperationsExportScope): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '기준 데이터 전체';
    default:
      return '전체 기간';
  }
}

function isExportScope(value: string | null): value is OperationsExportScope {
  return exportScopes.includes(value as OperationsExportScope);
}

function readPeriodRecordLabel(period: ExportPeriodRecord): string {
  return readPeriodLabel(period.year, period.month);
}

function readPeriodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function mapOperationalNote(note: OperationalNoteRecord): OperationsNoteItem {
  return {
    id: note.id,
    kind: note.kind,
    title: note.title,
    body: note.body,
    relatedHref: note.relatedHref,
    periodId: note.periodId,
    periodLabel: note.period
      ? readPeriodLabel(note.period.year, note.period.month)
      : null,
    authorMembershipId: note.authorMembershipId,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  };
}

function readLatestIso(values: Array<string | null>): string | null {
  return values
    .flatMap((value) => (value ? [value] : []))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function readLatestDateValue(
  values: Array<Date | string | null | undefined>
): string | null {
  const latest = values
    .map((value) => readDateObject(value))
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latest?.toISOString() ?? null;
}

function readDateValue(value: Date | string | null | undefined): string {
  return readDateObject(value)?.toISOString() ?? '';
}

function readDateObject(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function toCsv(rows: CsvRow[]): string {
  return `\ufeff${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

function escapeCsvCell(cell: CsvCell): string {
  const value = cell instanceof Date ? cell.toISOString() : String(cell ?? '');
  const escaped = value.replaceAll('"', '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
