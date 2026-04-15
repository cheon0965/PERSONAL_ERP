'use client';

import type { Route } from 'next';
import { SectionTabs } from '@/shared/ui/section-tabs';

function buildFinancialStatementsDetailHref(periodId: string | null) {
  if (!periodId) {
    return '/financial-statements';
  }

  return `/financial-statements/${periodId}` as Route;
}

export function FinancialStatementsSectionNav({
  selectedPeriodId
}: {
  selectedPeriodId: string | null;
}) {
  const detailHref = buildFinancialStatementsDetailHref(selectedPeriodId);

  return (
    <SectionTabs
      ariaLabel="재무제표 하위 화면 이동"
      items={[
        {
          href: '/financial-statements',
          label: '생성 / 선택'
        },
        {
          href: detailHref,
          label: '보고서 보기',
          matchPrefixes: ['/financial-statements/']
        }
      ]}
    />
  );
}
