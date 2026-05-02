import { AccountingPeriodsPage } from '@/features/accounting-periods/accounting-periods-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '월 마감',
  description:
    '미확정 거래, 전표, 재무제표, 이월 기준을 확인하고 월 마감 가능 여부를 판단합니다.'
});

export default function AccountingPeriodsClosePage() {
  return <AccountingPeriodsPage section="close" />;
}
