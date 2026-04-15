import { ImportsPage } from '@/features/imports/imports-page';

export default async function ImportsWorkbenchRoute({
  params
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  return <ImportsPage mode="detail" selectedBatchId={batchId} />;
}
