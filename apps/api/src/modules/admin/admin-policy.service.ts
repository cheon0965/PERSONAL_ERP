import { Injectable } from '@nestjs/common';
import type {
  AdminPolicySummary,
  AdminPolicySurfaceItem
} from '@personal-erp/contracts';

const adminPolicyItems: AdminPolicySurfaceItem[] = [
  {
    key: 'settings-context',
    section: 'SETTINGS',
    sectionLabel: '설정',
    surfaceLabel: '작업 문맥',
    href: '/settings',
    description: '현재 사업장, 멤버십, 기본 장부 문맥을 확인합니다.',
    allowedRoles: ['OWNER', 'MANAGER', 'EDITOR', 'VIEWER'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'settings-workspace',
    section: 'SETTINGS',
    sectionLabel: '설정',
    surfaceLabel: '사업장 설정',
    href: '/settings/workspace',
    description: '사업장명, 슬러그, 상태와 기본 장부 정보를 관리합니다.',
    allowedRoles: ['OWNER', 'MANAGER'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'settings-account',
    section: 'SETTINGS',
    sectionLabel: '설정',
    surfaceLabel: '내 계정 / 보안',
    href: '/settings/account',
    description: '본인 계정 정보, 비밀번호, 세션 보안을 관리합니다.',
    allowedRoles: ['OWNER', 'MANAGER', 'EDITOR', 'VIEWER'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'admin-members',
    section: 'ADMIN',
    sectionLabel: '관리자',
    surfaceLabel: '회원관리',
    href: '/admin/members',
    description:
      '목록 열람은 Owner/Manager, 역할 및 상태 변경과 초대는 Owner 중심으로 운영합니다.',
    allowedRoles: ['OWNER', 'MANAGER'],
    ctaPolicy: 'READ_ONLY'
  },
  {
    key: 'admin-logs',
    section: 'ADMIN',
    sectionLabel: '관리자',
    surfaceLabel: '로그관리',
    href: '/admin/logs',
    description: '감사 로그와 requestId 추적은 Owner 전용으로 유지합니다.',
    allowedRoles: ['OWNER'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'admin-policy',
    section: 'ADMIN',
    sectionLabel: '관리자',
    surfaceLabel: '권한 정책 요약',
    href: '/admin/policy',
    description: '운영 화면의 CTA 노출과 역할 기준을 한 곳에서 확인합니다.',
    allowedRoles: ['OWNER', 'MANAGER'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'reference-data',
    section: 'REFERENCE_DATA',
    sectionLabel: '기준 데이터',
    surfaceLabel: '기준 데이터 관리',
    href: '/reference-data/manage',
    description:
      '자금수단과 카테고리 편집은 Owner/Manager 중심으로 열고, 나머지 역할은 준비 상태 확인에 집중합니다.',
    allowedRoles: ['OWNER', 'MANAGER'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'monthly-operations',
    section: 'MONTHLY_OPERATIONS',
    sectionLabel: '월 운영',
    surfaceLabel: '운영 기간과 마감',
    href: '/periods',
    description:
      '기간 열기와 일반 운영은 Owner/Manager, 최종 마감과 재오픈은 Owner 기준으로 제한합니다.',
    allowedRoles: ['OWNER', 'MANAGER'],
    ctaPolicy: 'READ_ONLY'
  },
  {
    key: 'imports',
    section: 'IMPORTS',
    sectionLabel: '업로드',
    surfaceLabel: '업로드 배치',
    href: '/imports',
    description: '거래 업로드와 수집 보정은 Owner/Manager/Editor가 수행합니다.',
    allowedRoles: ['OWNER', 'MANAGER', 'EDITOR'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'transactions',
    section: 'TRANSACTIONS',
    sectionLabel: '거래 / 전표',
    surfaceLabel: '수집 거래와 전표 보정',
    href: '/transactions',
    description:
      '수집 거래 생성, 수정, 확정은 Owner/Manager/Editor가 담당하고 조회 전용 역할은 검토에 집중합니다.',
    allowedRoles: ['OWNER', 'MANAGER', 'EDITOR'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'reporting',
    section: 'REPORTING',
    sectionLabel: '보고',
    surfaceLabel: '재무제표와 차기 이월',
    href: '/financial-statements',
    description: '공식 산출물 생성은 Owner/Manager 기준으로 제한합니다.',
    allowedRoles: ['OWNER', 'MANAGER'],
    ctaPolicy: 'ALLOW'
  },
  {
    key: 'dashboard',
    section: 'DASHBOARD',
    sectionLabel: '대시보드',
    surfaceLabel: '요약 대시보드',
    href: '/dashboard',
    description: '모든 활성 멤버가 현재 사업장 상태를 조회할 수 있습니다.',
    allowedRoles: ['OWNER', 'MANAGER', 'EDITOR', 'VIEWER'],
    ctaPolicy: 'ALLOW'
  }
];

@Injectable()
export class AdminPolicyService {
  getSummary(): AdminPolicySummary {
    return {
      items: adminPolicyItems
    };
  }
}
