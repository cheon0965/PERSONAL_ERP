'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

const adminSectionItems = [
  { href: '/admin', label: '관리자 개요' },
  { href: '/admin/members', label: '회원 관리' },
  { href: '/admin/navigation', label: '메뉴 / 권한' },
  { href: '/admin/logs', label: '로그 관리' },
  { href: '/admin/policy', label: '권한 정책' }
] as const;

export function AdminSectionNav() {
  return (
    <SectionTabs items={adminSectionItems} ariaLabel="관리자 하위 화면 이동" />
  );
}
