import { CarryForwardsPage } from '@/features/carry-forwards/carry-forwards-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '차기 이월 결과',
  description: '선택한 운영 기간의 이월 결과와 다음 월로 이어지는 기준 금액을 확인합니다.'
});

export default async function CarryForwardsDetailRoute({
  params
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;

  return <CarryForwardsPage mode="detail" selectedPeriodId={periodId} />;
}
