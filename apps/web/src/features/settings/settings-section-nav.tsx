'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

const settingsSectionItems = [
  { href: '/settings', label: '작업 기준' },
  { href: '/settings/workspace', label: '사업장 설정' },
  { href: '/settings/account/profile', label: '기본 정보' },
  { href: '/settings/account/password', label: '비밀번호' },
  { href: '/settings/account/sessions', label: '세션' },
  { href: '/settings/account/events', label: '보안 이벤트' }
] as const;

export function SettingsSectionNav() {
  return (
    <SectionTabs items={settingsSectionItems} ariaLabel="설정 하위 화면 이동" />
  );
}
