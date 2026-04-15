'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

export type PeriodWorkspaceSection = 'overview' | 'open' | 'close' | 'history';

const periodSectionItems = [
  { href: '/periods', label: '현재 상태' },
  { href: '/periods/open', label: '월 운영 시작' },
  { href: '/periods/close', label: '월 마감 / 재오픈' },
  { href: '/periods/history', label: '기간 이력' }
] as const;

export function PeriodsSectionNav() {
  return (
    <SectionTabs items={periodSectionItems} ariaLabel="월 운영 하위 화면 이동" />
  );
}
