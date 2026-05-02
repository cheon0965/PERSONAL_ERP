import { CarryForwardsPage } from '@/features/carry-forwards/carry-forwards-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '이월 기준 생성 / 선택',
  description:
    '월 마감 후 다음 운영 기간으로 넘길 잔액과 기준 데이터를 생성하거나 선택합니다.'
});

export default function CarryForwardsRoute() {
  return <CarryForwardsPage mode="overview" />;
}
