import { FinancialStatementsPage } from '@/features/financial-statements/financial-statements-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '재무제표 상세',
  description: '선택한 운영 기간의 재무제표 스냅샷과 손익, 자산, 부채 기준 숫자를 확인합니다.'
});

export default async function FinancialStatementsDetailRoute({
  params
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;

  return <FinancialStatementsPage mode="detail" selectedPeriodId={periodId} />;
}
