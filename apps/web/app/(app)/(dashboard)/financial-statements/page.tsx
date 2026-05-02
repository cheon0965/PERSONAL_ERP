import { FinancialStatementsPage } from '@/features/financial-statements/financial-statements-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '재무제표 생성 / 선택',
  description: '운영 기간별 재무제표 스냅샷을 생성하거나 선택해 공식 보고 숫자를 확인합니다.'
});

export default function FinancialStatementsRoute() {
  return <FinancialStatementsPage mode="overview" />;
}
