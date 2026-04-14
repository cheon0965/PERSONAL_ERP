'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

const settingsSectionItems = [
  { href: '/settings', label: '작업 기준' },
  { href: '/settings/workspace', label: '사업장' },
  { href: '/settings/account', label: '내 계정' }
] as const;

export function SettingsSectionNav() {
  return <SectionTabs items={settingsSectionItems} ariaLabel="설정 하위 화면 이동" />;
}
