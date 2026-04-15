'use client';

import type { Route } from 'next';
import { SectionTabs } from '@/shared/ui/section-tabs';

function buildCarryForwardsDetailHref(periodId: string | null) {
  if (!periodId) {
    return '/carry-forwards';
  }

  return `/carry-forwards/${periodId}` as Route;
}

export function CarryForwardsSectionNav({
  selectedPeriodId
}: {
  selectedPeriodId: string | null;
}) {
  const detailHref = buildCarryForwardsDetailHref(selectedPeriodId);

  return (
    <SectionTabs
      ariaLabel="차기 이월 하위 화면 이동"
      items={[
        {
          href: '/carry-forwards',
          label: '생성 / 선택'
        },
        {
          href: detailHref,
          label: '결과 보기',
          matchPrefixes: ['/carry-forwards/']
        }
      ]}
    />
  );
}
