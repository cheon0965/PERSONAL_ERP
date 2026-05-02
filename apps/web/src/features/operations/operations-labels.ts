import type {
  ImportBatchParseStatus,
  ImportSourceKind,
  OperationsAlertKind,
  OperationsExceptionKind,
  OperationsExportScope,
  OperationsNoteKind,
  OperationsReadinessStatus,
  OperationsSeverity,
  OperationsSystemComponentStatus
} from '@personal-erp/contracts';

export function readOperationsStatusLabel(
  status: OperationsReadinessStatus
): string {
  switch (status) {
    case 'READY':
      return '준비됨';
    case 'ACTION_REQUIRED':
      return '처리 필요';
    case 'BLOCKED':
      return '차단';
    case 'INFO':
      return '참고';
    default:
      return status;
  }
}

export function readOperationsStatusColor(
  status: OperationsReadinessStatus
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'READY':
      return 'success';
    case 'ACTION_REQUIRED':
      return 'warning';
    case 'BLOCKED':
      return 'error';
    case 'INFO':
    default:
      return 'info';
  }
}

export function readOperationsSeverityLabel(
  severity: OperationsSeverity
): string {
  switch (severity) {
    case 'CRITICAL':
      return '긴급';
    case 'WARNING':
      return '경고';
    case 'INFO':
      return '참고';
    default:
      return severity;
  }
}

export function readOperationsSeverityColor(
  severity: OperationsSeverity
): 'default' | 'warning' | 'error' | 'info' {
  switch (severity) {
    case 'CRITICAL':
      return 'error';
    case 'WARNING':
      return 'warning';
    case 'INFO':
    default:
      return 'info';
  }
}

export function readOperationsExceptionKindLabel(
  kind: OperationsExceptionKind
): string {
  switch (kind) {
    case 'REFERENCE_DATA':
      return '기준 데이터';
    case 'COLLECTED_TRANSACTION':
      return '수집 거래';
    case 'IMPORT_ROW':
      return '업로드 행';
    case 'MONTH_CLOSE':
      return '월 마감';
    case 'AUDIT_EVENT':
      return '감사 이벤트';
    default:
      return kind;
  }
}

export function readOperationsAlertKindLabel(
  kind: OperationsAlertKind
): string {
  switch (kind) {
    case 'REFERENCE_DATA':
      return '기준 데이터';
    case 'IMPORT':
      return '업로드';
    case 'MONTH_CLOSE':
      return '월 마감';
    case 'SECURITY':
      return '보안/권한';
    case 'SYSTEM':
      return '시스템';
    default:
      return kind;
  }
}

export function readOperationsExportScopeLabel(
  scope: OperationsExportScope
): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '기준 데이터';
    case 'COLLECTED_TRANSACTIONS':
      return '수집 거래';
    case 'JOURNAL_ENTRIES':
      return '전표';
    case 'FINANCIAL_STATEMENTS':
      return '재무제표';
    default:
      return scope;
  }
}

export function readOperationsNoteKindLabel(kind: OperationsNoteKind): string {
  switch (kind) {
    case 'GENERAL':
      return '일반 메모';
    case 'MONTH_END':
      return '월 마감';
    case 'EXCEPTION':
      return '예외 처리';
    case 'ALERT':
      return '알림 후속';
    case 'FOLLOW_UP':
      return '후속 조치';
    default:
      return kind;
  }
}

export function readSystemComponentStatusLabel(
  status: OperationsSystemComponentStatus
): string {
  switch (status) {
    case 'OPERATIONAL':
      return '정상';
    case 'DEGRADED':
      return '주의';
    case 'DOWN':
      return '장애';
    case 'UNKNOWN':
      return '미확인';
    default:
      return status;
  }
}

export function readSystemComponentStatusColor(
  status: OperationsSystemComponentStatus
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'OPERATIONAL':
      return 'success';
    case 'DEGRADED':
      return 'warning';
    case 'DOWN':
      return 'error';
    case 'UNKNOWN':
    default:
      return 'info';
  }
}

export function readImportSourceKindLabel(
  sourceKind: ImportSourceKind
): string {
  switch (sourceKind) {
    case 'CARD_EXCEL':
      return '카드 엑셀';
    case 'BANK_CSV':
      return '은행 CSV';
    case 'MANUAL_UPLOAD':
      return '수동 업로드';
    case 'IM_BANK_PDF':
      return 'IM뱅크 PDF';
    case 'WOORI_BANK_HTML':
      return '우리은행 HTML';
    case 'WOORI_CARD_HTML':
      return '우리카드 HTML';
    case 'KB_KOOKMIN_BANK_PDF':
      return 'KB국민은행 PDF';
    default:
      return sourceKind;
  }
}

export function readImportBatchParseStatusLabel(
  status: ImportBatchParseStatus
): string {
  switch (status) {
    case 'COMPLETED':
      return '완료';
    case 'PARTIAL':
      return '부분 완료';
    case 'FAILED':
      return '실패';
    case 'PENDING':
      return '대기';
    default:
      return status;
  }
}
