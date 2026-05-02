import { AccountingPeriodsPage } from '@/features/accounting-periods/accounting-periods-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '운영 기간',
  description: '월 운영 시작, 마감, 재오픈 가능 상태와 최근 마감 스냅샷을 확인합니다.'
});

export default function Page() {
  return <AccountingPeriodsPage section="overview" />;
}
