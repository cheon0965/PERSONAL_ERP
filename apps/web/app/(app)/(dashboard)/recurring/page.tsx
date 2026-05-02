import { RecurringRulesPage } from '@/features/recurring-rules/recurring-rules-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '반복 규칙',
  description:
    '월세, 보험료, 정기 결제처럼 반복되는 운영 거래 규칙과 생성 상태를 관리합니다.'
});

export default function Page() {
  return <RecurringRulesPage />;
}
