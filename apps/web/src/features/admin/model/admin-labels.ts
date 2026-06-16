import type {
  TenantMembershipRole,
  TenantMembershipStatus
} from '@personal-erp/contracts';

export function readMembershipRoleLabel(
  role: TenantMembershipRole | string | null
) {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return '전체 관리자';
    case 'OWNER':
      return '소유자';
    case 'MANAGER':
      return '관리자';
    case 'EDITOR':
      return '편집자';
    case 'VIEWER':
      return '조회자';
    default:
      return role ?? '-';
  }
}

export function readMembershipStatusLabel(
  status: TenantMembershipStatus | string | null
) {
  switch (status) {
    case 'INVITED':
      return '초대됨';
    case 'ACTIVE':
      return '활성';
    case 'SUSPENDED':
      return '중지';
    case 'REMOVED':
      return '제거됨';
    default:
      return status ?? '-';
  }
}

export function readAuditResultLabel(result: string | null) {
  switch (result) {
    case 'SUCCESS':
      return '성공';
    case 'DENIED':
      return '거부';
    case 'FAILED':
      return '실패';
    default:
      return result ?? '-';
  }
}

export function readUserStatusLabel(status: string | null) {
  switch (status) {
    case 'ACTIVE':
      return '활성';
    case 'LOCKED':
      return '잠금';
    case 'DISABLED':
      return '비활성';
    default:
      return status ?? '-';
  }
}

export function readTenantStatusLabel(status: string | null) {
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

export function readOperationsStatusLabel(status: string | null) {
  switch (status) {
    case 'OK':
      return '정상';
    case 'WARNING':
      return '주의';
    case 'ERROR':
      return '오류';
    case 'UNKNOWN':
      return '확인 필요';
    default:
      return status ?? '-';
  }
}

export function readSecurityThreatSeverityLabel(severity: string | null) {
  switch (severity) {
    case 'CRITICAL':
      return '긴급';
    case 'HIGH':
      return '높음';
    case 'MEDIUM':
      return '주의';
    case 'LOW':
      return '낮음';
    default:
      return severity ?? '-';
  }
}

export function readSecurityThreatCategoryLabel(category: string | null) {
  switch (category) {
    case 'AUTHENTICATION':
      return '인증';
    case 'REGISTRATION':
      return '회원가입';
    case 'SESSION':
      return '세션';
    case 'EMAIL_VERIFICATION':
      return '이메일 인증';
    case 'ACCESS_CONTROL':
      return '접근 제어';
    case 'BROWSER_ORIGIN':
      return '브라우저 출처';
    case 'EMAIL_DELIVERY':
      return '이메일 발송';
    case 'SYSTEM':
      return '시스템';
    default:
      return category ?? '-';
  }
}

export function readPolicyCtaLabel(policy: string | null) {
  switch (policy) {
    case 'ALLOW':
      return '메뉴 노출';
    case 'READ_ONLY':
      return '읽기 중심';
    case 'HIDE':
      return '메뉴 숨김';
    default:
      return policy ?? '-';
  }
}
