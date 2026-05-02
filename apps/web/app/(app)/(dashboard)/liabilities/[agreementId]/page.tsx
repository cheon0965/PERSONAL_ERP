import { LiabilitiesPage } from '@/features/liabilities/liabilities-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '부채 / 약정 상세',
  description:
    '선택한 약정의 상세 조건, 연결 거래, 상환 상태와 잔액 정보를 확인합니다.'
});

export default async function LiabilityDetailRoute({
  params
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;

  return <LiabilitiesPage mode="detail" selectedAgreementId={agreementId} />;
}
