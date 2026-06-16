'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

const settingsSectionItems = [
  { href: '/settings', label: '현재 사업장 / 장부' },
  { href: '/settings/workspace', label: '사업장 설정' }
] as const;

export function SettingsSectionNav() {
  return (
    <SectionTabs items={settingsSectionItems} ariaLabel="설정 하위 화면 이동" />
  );
}
