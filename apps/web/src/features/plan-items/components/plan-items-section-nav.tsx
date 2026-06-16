'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

const planItemsSectionItems = [
  { href: '/plan-items', label: '계획 항목' },
  { href: '/plan-items/generate', label: '계획 생성' }
] as const;

export function PlanItemsSectionNav() {
  return (
    <SectionTabs
      items={planItemsSectionItems}
      ariaLabel="계획 항목 하위 화면 이동"
    />
  );
}
