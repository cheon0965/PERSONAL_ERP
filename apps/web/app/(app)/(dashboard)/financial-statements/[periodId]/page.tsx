import { FinancialStatementsPage } from '@/features/financial-statements/financial-statements-page';

export default async function FinancialStatementsDetailRoute({
  params
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;

  return <FinancialStatementsPage mode="detail" selectedPeriodId={periodId} />;
}
