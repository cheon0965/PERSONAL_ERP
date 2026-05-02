import { FundingAccountStatusPage } from '@/features/funding-account-status/funding-account-status-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '자금수단 상태',
  description: '은행 계좌와 카드 자금수단의 활성 상태, 연결 상태, 운영 준비 여부를 확인합니다.'
});

export default function Page() {
  return <FundingAccountStatusPage />;
}
