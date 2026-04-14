import type {
  AccountSecurityEventKind,
  LedgerStatus,
  TenantStatus
} from '@personal-erp/contracts';

export function readTenantStatusLabel(status: TenantStatus | string | null) {
  switch (status) {
    case 'TRIAL':
      return '체험';
    case 'ACTIVE':
      return '활성';
    case 'SUSPENDED':
      return '중지';
    case 'ARCHIVED':
      return '보관';
    default:
      return status ?? '-';
  }
}

export function readLedgerStatusLabel(status: LedgerStatus | string | null) {
  switch (status) {
    case 'ACTIVE':
      return '활성';
    case 'SUSPENDED':
      return '중지';
    case 'ARCHIVED':
      return '보관';
    default:
      return status ?? '-';
  }
}

export function readAccountSecurityEventLabel(
  kind: AccountSecurityEventKind | string | null
) {
  switch (kind) {
    case 'SESSION_CREATED':
      return '로그인 세션 생성';
    case 'SESSION_REVOKED':
      return '세션 종료';
    case 'PASSWORD_CHANGED':
      return '비밀번호 변경';
    case 'PROFILE_UPDATED':
      return '계정 이름 변경';
    default:
      return kind ?? '-';
  }
}
