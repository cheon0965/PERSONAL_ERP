'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

const referenceDataSectionItems = [
  {
    href: '/reference-data',
    label: '준비 상태'
  },
  {
    href: '/reference-data/manage',
    label: '기준 데이터 관리'
  }
] as const;

export function ReferenceDataSectionNav() {
  return (
    <SectionTabs
      items={referenceDataSectionItems}
      ariaLabel="기준 데이터 하위 화면 이동"
    />
  );
}
