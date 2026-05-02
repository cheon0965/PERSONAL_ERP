import { AccountingPeriodsPage } from '@/features/accounting-periods/accounting-periods-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '월 운영 시작',
  description:
    '새 운영 기간을 열고 기준 데이터와 월별 업무 흐름을 시작할 준비 상태를 확인합니다.'
});

export default function AccountingPeriodsOpenPage() {
  return <AccountingPeriodsPage section="open" />;
}
