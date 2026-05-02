import { ForecastPage } from '@/features/forecast/forecast-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '기간 운영 전망',
  description:
    '현재 운영 기간의 예정 거래, 수집 거래, 전표 상태를 바탕으로 마감 전 위험을 확인합니다.'
});

export default function Page() {
  return <ForecastPage />;
}
