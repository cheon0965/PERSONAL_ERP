import { PlanItemsPage } from '@/features/plan-items/plan-items-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '계획 항목',
  description: '반복 규칙에서 생성된 예정 거래를 검토하고 실제 수집 거래와 전표 흐름으로 연결합니다.'
});

export default function PlanItemsRoute() {
  return <PlanItemsPage />;
}
