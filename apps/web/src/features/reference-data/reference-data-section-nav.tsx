'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

const referenceDataSectionItems = [
  {
    href: '/reference-data',
    label: '기준 데이터 준비 상태'
  },
  {
    href: '/reference-data/funding-accounts',
    label: '자금수단'
  },
  {
    href: '/reference-data/categories',
    label: '카테고리'
  },
  {
    href: '/reference-data/lookups',
    label: '공식 참조값'
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
