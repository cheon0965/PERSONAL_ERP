'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

const operationsSectionItems = [
  { href: '/operations', label: '운영 허브' },
  { href: '/operations/checklist', label: '운영 체크리스트' },
  { href: '/operations/exceptions', label: '예외 처리함' },
  { href: '/operations/month-end', label: '월 마감' },
  { href: '/operations/imports', label: '업로드 운영 현황' },
  { href: '/operations/status', label: '시스템 상태' },
  { href: '/operations/alerts', label: '알림 / 이벤트 센터' },
  { href: '/operations/exports', label: '백업 / 내보내기' },
  { href: '/operations/notes', label: '운영 메모 / 인수인계' }
] as const;

export function OperationsSectionNav() {
  return (
    <SectionTabs
      items={operationsSectionItems}
      ariaLabel="운영 지원 하위 화면 이동"
    />
  );
}
