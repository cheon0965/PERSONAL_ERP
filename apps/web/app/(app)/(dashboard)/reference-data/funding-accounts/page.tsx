import { ReferenceDataManagementPage } from '@/features/reference-data/reference-data-management-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '자금수단',
  description: '은행 계좌와 카드 자금수단을 등록하고 업로드, 거래, 전표 연결 기준을 관리합니다.'
});

export default function FundingAccountsRoutePage() {
  return <ReferenceDataManagementPage section="funding-accounts" />;
}
