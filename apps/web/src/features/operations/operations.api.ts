'use client';

import type {
  CreateOperationsExportRequest,
  CreateOperationsNoteRequest,
  OperationsChecklistResponse,
  OperationsExceptionsResponse,
  OperationsAlertsResponse,
  OperationsExportResult,
  OperationsExportsResponse,
  OperationsHubSummary,
  OperationsImportStatusSummary,
  OperationsMonthEndSummary,
  OperationsNoteItem,
  OperationsNotesResponse,
  OperationsSystemStatusSummary
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '../../shared/api/fetch-json';

const mockPeriod = {
  id: 'period-demo-live',
  year: 2026,
  month: 4,
  monthLabel: '2026-04',
  startDate: '2026-04-01T00:00:00.000Z',
  endDate: '2026-05-01T00:00:00.000Z',
  status: 'OPEN' as const,
  openedAt: '2026-04-01T00:00:00.000Z',
  lockedAt: null,
  hasOpeningBalanceSnapshot: true,
  openingBalanceSourceKind: 'CARRY_FORWARD' as const,
  statusHistory: []
};

export const mockOperationsChecklist: OperationsChecklistResponse = {
  generatedAt: '2026-04-30T09:00:00.000Z',
  currentPeriod: mockPeriod,
  totals: {
    ready: 6,
    actionRequired: 2,
    blocked: 0
  },
  groups: [
    {
      key: 'MONTH_START',
      title: '월 시작 전',
      description:
        '월 운영을 시작하기 전에 기준 데이터와 운영 기간을 확인합니다.',
      items: [
        {
          id: 'reference-data-ready',
          title: '기준 데이터 준비',
          description:
            '자금수단, 카테고리, 계정과목, 거래유형이 준비되어야 합니다.',
          status: 'READY',
          detail: '필수 기준 데이터가 준비되어 있습니다.',
          blockingReason: null,
          actionLabel: '기준 데이터 확인',
          href: '/reference-data'
        },
        {
          id: 'current-period-ready',
          title: '현재 운영 기간',
          description: '거래 수집과 월 마감을 위한 운영 기간이 필요합니다.',
          status: 'READY',
          detail: '2026-04 기간을 기준으로 운영합니다.',
          blockingReason: null,
          actionLabel: '월 운영 보기',
          href: '/periods'
        }
      ]
    },
    {
      key: 'DAILY',
      title: '일일 점검',
      description: '매일 처리할 수집 거래와 업로드 대기 행을 확인합니다.',
      items: [
        {
          id: 'unresolved-transactions',
          title: '미확정 수집 거래',
          description: '전표로 확정되지 않은 수집 거래를 확인합니다.',
          status: 'ACTION_REQUIRED',
          detail: '준비 또는 검토 상태 거래가 남아 있습니다.',
          blockingReason: null,
          actionLabel: '수집 거래 보기',
          href: '/transactions'
        },
        {
          id: 'import-row-backlog',
          title: '업로드 미수집 행',
          description:
            '정상적으로 읽었지만 아직 수집 거래로 등록되지 않은 행을 처리합니다.',
          status: 'ACTION_REQUIRED',
          detail:
            '정상 파싱된 미수집 행을 등록하면 업로드 흐름을 이어갈 수 있습니다.',
          blockingReason: null,
          actionLabel: '업로드 보기',
          href: '/imports'
        }
      ]
    }
  ]
};

export const mockOperationsExceptions: OperationsExceptionsResponse = {
  generatedAt: mockOperationsChecklist.generatedAt,
  totalCount: 2,
  criticalCount: 0,
  warningCount: 2,
  items: [
    {
      id: 'unresolved-collected-transactions',
      kind: 'COLLECTED_TRANSACTION',
      severity: 'WARNING',
      title: '미확정 수집 거래',
      description: '검토 또는 전표 준비 상태의 정상 수집 거래가 남아 있습니다.',
      count: 5,
      primaryActionLabel: '수집 거래 처리',
      href: '/transactions',
      lastOccurredAt: '2026-04-29T00:00:00.000Z'
    },
    {
      id: 'uncollected-import-rows',
      kind: 'IMPORT_ROW',
      severity: 'WARNING',
      title: '업로드 미수집 행',
      description:
        '정상적으로 읽었지만 아직 수집 거래로 등록되지 않은 행입니다.',
      count: 5,
      primaryActionLabel: '업로드 행 수집',
      href: '/imports',
      lastOccurredAt: '2026-04-30T09:00:00.000Z'
    }
  ]
};

export const mockOperationsMonthEnd: OperationsMonthEndSummary = {
  generatedAt: mockOperationsChecklist.generatedAt,
  period: mockPeriod,
  periodStatus: 'OPEN',
  closeReadiness: 'ACTION_REQUIRED',
  closeReadinessLabel: '마감 전 확인할 정상 운영 항목이 남아 있습니다.',
  unresolvedTransactionCount: 5,
  failedImportRowCount: 0,
  remainingPlanItemCount: 2,
  remainingPlannedExpenseWon: 223_000,
  financialStatementSnapshotCount: 0,
  carryForwardCreated: false,
  blockers: [],
  warnings: [
    '전표 준비 또는 검토 상태의 수집 거래를 확정해야 합니다.',
    '남은 계획 항목 2건을 확인해야 합니다.'
  ]
};

export const mockOperationsImportStatus: OperationsImportStatusSummary = {
  generatedAt: mockOperationsChecklist.generatedAt,
  totalBatchCount: 2,
  totalRowCount: 17,
  failedRowCount: 0,
  uncollectedRowCount: 5,
  collectedRowCount: 12,
  collectionRate: 0.706,
  latestUploadedAt: '2026-04-30T10:00:00.000Z',
  batches: [
    {
      id: 'import-batch-demo-1',
      fileName: 'demo-bank-2026-04.csv',
      sourceKind: 'BANK_CSV',
      parseStatus: 'COMPLETED',
      uploadedAt: '2026-04-30T09:00:00.000Z',
      rowCount: 12,
      parsedRowCount: 12,
      failedRowCount: 0,
      uncollectedRowCount: 2,
      collectionRate: 0.833
    },
    {
      id: 'import-batch-demo-2',
      fileName: 'demo-card-2026-04.xlsx',
      sourceKind: 'CARD_EXCEL',
      parseStatus: 'COMPLETED',
      uploadedAt: '2026-04-30T10:00:00.000Z',
      rowCount: 5,
      parsedRowCount: 5,
      failedRowCount: 0,
      uncollectedRowCount: 3,
      collectionRate: 0.4
    }
  ]
};

export const mockOperationsSystemStatus: OperationsSystemStatusSummary = {
  generatedAt: mockOperationsChecklist.generatedAt,
  overallStatus: 'OPERATIONAL',
  components: [
    {
      key: 'api',
      label: '서비스 프로세스',
      status: 'OPERATIONAL',
      detail: '운영 콘솔 서비스가 응답하고 있습니다.',
      lastCheckedAt: mockOperationsChecklist.generatedAt
    },
    {
      key: 'database',
      label: '데이터베이스 연결',
      status: 'OPERATIONAL',
      detail: '데이터베이스 상태 확인이 성공했습니다.',
      lastCheckedAt: mockOperationsChecklist.generatedAt
    },
    {
      key: 'audit-events',
      label: '감사 로그',
      status: 'OPERATIONAL',
      detail: '최근 감사 이벤트가 정상적으로 기록되고 있습니다.',
      lastCheckedAt: mockOperationsChecklist.generatedAt
    },
    {
      key: 'mail',
      label: '메일 발송',
      status: 'OPERATIONAL',
      detail: '콘솔 메일 어댑터를 사용합니다.',
      lastCheckedAt: mockOperationsChecklist.generatedAt
    }
  ],
  build: {
    environment: 'development',
    nodeVersion: 'v22.0.0',
    appVersion: 'local',
    commitSha: null,
    uptimeSeconds: 3600
  },
  recentActivity: {
    lastSuccessfulAuditEventAt: '2026-04-30T09:00:00.000Z',
    lastFailedAuditEventAt: null,
    lastImportUploadedAt: '2026-04-30T10:00:00.000Z',
    lastEmailBoundaryEventAt: null
  },
  mail: {
    provider: 'console',
    status: 'OPERATIONAL',
    detail: '콘솔 메일 어댑터를 사용합니다.',
    lastBoundaryEventAt: null
  }
};

export const mockOperationsAlerts: OperationsAlertsResponse = {
  generatedAt: mockOperationsChecklist.generatedAt,
  totalCount: 2,
  criticalCount: 0,
  warningCount: 2,
  items: [
    {
      id: 'alert-month-close',
      kind: 'MONTH_CLOSE',
      severity: 'WARNING',
      title: '월 마감 전 확인',
      description: '전표 준비 또는 검토 상태의 정상 수집 거래를 확정하세요.',
      actionLabel: '월 마감 대시보드',
      href: '/operations/month-end',
      sourceAuditEventId: null,
      requestId: null,
      createdAt: '2026-04-30T10:00:00.000Z'
    },
    {
      id: 'alert-import',
      kind: 'IMPORT',
      severity: 'WARNING',
      title: '업로드 미수집 행',
      description:
        '정상적으로 읽었지만 아직 수집 거래로 등록되지 않은 행입니다.',
      actionLabel: '업로드 행 수집',
      href: '/imports',
      sourceAuditEventId: null,
      requestId: null,
      createdAt: '2026-04-30T09:00:00.000Z'
    }
  ]
};

export const mockOperationsExports: OperationsExportsResponse = {
  generatedAt: mockOperationsChecklist.generatedAt,
  lastExportedAt: '2026-04-30T11:00:00.000Z',
  items: [
    {
      scope: 'REFERENCE_DATA',
      label: '기준 데이터',
      description:
        '자금수단, 카테고리, 계정과목, 거래유형을 한 번에 CSV로 반출합니다.',
      rowCount: 18,
      rangeLabel: '기준 데이터 전체',
      latestSourceAt: '2026-04-30T09:00:00.000Z',
      latestExportedAt: '2026-04-30T11:00:00.000Z',
      recommendedCadence: '기준 데이터 변경 후',
      enabled: true
    },
    {
      scope: 'COLLECTED_TRANSACTIONS',
      label: '수집 거래',
      description:
        '수집 거래의 상태, 금액, 업로드 연결 정보를 CSV로 반출합니다.',
      rowCount: 24,
      rangeLabel: '전체 기간',
      latestSourceAt: '2026-04-30T09:00:00.000Z',
      latestExportedAt: null,
      recommendedCadence: '월 마감 전/후',
      enabled: true
    }
  ]
};

export const mockOperationsExportResult: OperationsExportResult = {
  exportId: 'operations-export-demo',
  scope: 'COLLECTED_TRANSACTIONS',
  fileName: 'personal-erp-collected-transactions-demo.csv',
  contentType: 'text/csv; charset=utf-8',
  encoding: 'utf-8',
  rowCount: 1,
  rangeLabel: '전체 기간',
  generatedAt: mockOperationsChecklist.generatedAt,
  payload: '\ufeffid,title,amountWon\r\nctx-demo,정상 데모 거래,12000\r\n'
};

export const mockOperationsNotes: OperationsNotesResponse = {
  generatedAt: mockOperationsChecklist.generatedAt,
  totalCount: 1,
  items: [
    {
      id: 'operations-note-demo',
      kind: 'MONTH_END',
      title: '4월 마감 전 확인',
      body: '정상 파싱된 미수집 행과 전표 준비 거래를 확인한 뒤 월 마감 절차로 이동합니다.',
      relatedHref: '/operations/month-end',
      periodId: 'period-demo-live',
      periodLabel: '2026-04',
      authorMembershipId: 'membership-demo',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z'
    }
  ]
};

export const mockOperationsCreatedNote: OperationsNoteItem = {
  id: 'operations-note-created-demo',
  kind: 'GENERAL',
  title: '운영 인수인계',
  body: '다음 담당자가 알림 센터를 확인합니다.',
  relatedHref: '/operations/alerts',
  periodId: null,
  periodLabel: null,
  authorMembershipId: 'membership-demo',
  createdAt: mockOperationsChecklist.generatedAt,
  updatedAt: mockOperationsChecklist.generatedAt
};

export const mockOperationsSummary: OperationsHubSummary = {
  generatedAt: mockOperationsChecklist.generatedAt,
  checklist: mockOperationsChecklist,
  exceptions: mockOperationsExceptions,
  monthEnd: mockOperationsMonthEnd,
  imports: mockOperationsImportStatus,
  outstandingWorkCount: 7
};

export const operationsSummaryQueryKey = ['operations-summary'] as const;
export const operationsChecklistQueryKey = ['operations-checklist'] as const;
export const operationsExceptionsQueryKey = ['operations-exceptions'] as const;
export const operationsMonthEndQueryKey = ['operations-month-end'] as const;
export const operationsImportStatusQueryKey = [
  'operations-import-status'
] as const;
export const operationsSystemStatusQueryKey = [
  'operations-system-status'
] as const;
export const operationsAlertsQueryKey = ['operations-alerts'] as const;
export const operationsExportsQueryKey = ['operations-exports'] as const;
export const operationsNotesQueryKey = ['operations-notes'] as const;

export function getOperationsSummary() {
  return fetchJson<OperationsHubSummary>(
    '/operations/summary',
    mockOperationsSummary
  );
}

export function getOperationsChecklist() {
  return fetchJson<OperationsChecklistResponse>(
    '/operations/checklist',
    mockOperationsChecklist
  );
}

export function getOperationsExceptions() {
  return fetchJson<OperationsExceptionsResponse>(
    '/operations/exceptions',
    mockOperationsExceptions
  );
}

export function getOperationsMonthEnd() {
  return fetchJson<OperationsMonthEndSummary>(
    '/operations/month-end',
    mockOperationsMonthEnd
  );
}

export function getOperationsImportStatus() {
  return fetchJson<OperationsImportStatusSummary>(
    '/operations/import-status',
    mockOperationsImportStatus
  );
}

export function getOperationsSystemStatus() {
  return fetchJson<OperationsSystemStatusSummary>(
    '/operations/system-status',
    mockOperationsSystemStatus
  );
}

export function getOperationsAlerts() {
  return fetchJson<OperationsAlertsResponse>(
    '/operations/alerts',
    mockOperationsAlerts
  );
}

export function getOperationsExports() {
  return fetchJson<OperationsExportsResponse>(
    '/operations/exports',
    mockOperationsExports
  );
}

export function runOperationsExport(input: CreateOperationsExportRequest) {
  return postJson<OperationsExportResult, CreateOperationsExportRequest>(
    '/operations/exports',
    input,
    mockOperationsExportResult
  );
}

export function getOperationsNotes() {
  return fetchJson<OperationsNotesResponse>(
    '/operations/notes',
    mockOperationsNotes
  );
}

export function createOperationsNote(input: CreateOperationsNoteRequest) {
  return postJson<OperationsNoteItem, CreateOperationsNoteRequest>(
    '/operations/notes',
    input,
    mockOperationsCreatedNote
  );
}
