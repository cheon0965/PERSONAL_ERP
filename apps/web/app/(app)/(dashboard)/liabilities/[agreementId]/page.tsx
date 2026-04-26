import { LiabilitiesPage } from '@/features/liabilities/liabilities-page';

export default async function LiabilityDetailRoute({
  params
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;

  return <LiabilitiesPage mode="detail" selectedAgreementId={agreementId} />;
}
