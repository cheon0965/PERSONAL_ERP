import { InsurancePoliciesPage } from '@/features/insurance-policies/insurance-policies-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '보험 연동',
  description: '보험 계약, 납입 주기, 연결 거래 기준을 관리하고 운영 비용 흐름과 연결합니다.'
});

export default function Page() {
  return <InsurancePoliciesPage />;
}
