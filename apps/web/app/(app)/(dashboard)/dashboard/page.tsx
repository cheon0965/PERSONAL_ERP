import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '월 운영 대시보드',
  description: '수집 거래, 전표, 월 마감, 이월 상태를 한 화면에서 확인하고 다음 작업으로 이동합니다.'
});

export default function Page() {
  return <DashboardPage />;
}
