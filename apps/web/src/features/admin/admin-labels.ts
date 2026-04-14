import type {
  TenantMembershipRole,
  TenantMembershipStatus
} from '@personal-erp/contracts';

export function readMembershipRoleLabel(
  role: TenantMembershipRole | string | null
) {
  switch (role) {
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

export function readPolicyCtaLabel(policy: string | null) {
  switch (policy) {
    case 'ALLOW':
      return '버튼 노출';
    case 'READ_ONLY':
      return '읽기 중심';
    case 'HIDE':
      return 'CTA 숨김';
    default:
      return policy ?? '-';
  }
}
