import { AccountingPeriodsPage } from '@/features/accounting-periods/accounting-periods-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '마감 이력',
  description: '운영 기간별 마감 결과, 재오픈 가능 여부, 최근 스냅샷 이력을 확인합니다.'
});

export default function AccountingPeriodsHistoryPage() {
  return <AccountingPeriodsPage section="history" />;
}
