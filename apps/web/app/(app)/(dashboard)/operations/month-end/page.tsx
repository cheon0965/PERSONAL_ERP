import { OperationsMonthEndPage } from '@/features/operations/operations-month-end-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '월 마감 운영',
  description:
    '월 마감 전 차단 사유, 재무제표, 이월 기준, 운영 메모를 함께 확인합니다.'
});

export default function OperationsMonthEndRoutePage() {
  return <OperationsMonthEndPage />;
}
