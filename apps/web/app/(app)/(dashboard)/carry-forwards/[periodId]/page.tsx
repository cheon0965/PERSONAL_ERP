import { CarryForwardsPage } from '@/features/carry-forwards/carry-forwards-page';

export default async function CarryForwardsDetailRoute({
  params
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;

  return <CarryForwardsPage mode="detail" selectedPeriodId={periodId} />;
}
