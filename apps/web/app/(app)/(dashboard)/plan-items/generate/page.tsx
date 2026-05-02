import { PlanItemsPage } from '@/features/plan-items/plan-items-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '계획 생성',
  description: '반복 규칙을 기준으로 운영 기간의 예정 거래를 생성하고 누락된 계획 항목을 채웁니다.'
});

export default function PlanItemsGenerateRoutePage() {
  return <PlanItemsPage mode="generate" />;
}
