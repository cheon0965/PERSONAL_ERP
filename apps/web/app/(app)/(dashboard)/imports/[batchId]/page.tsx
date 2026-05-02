import { ImportsPage } from '@/features/imports/imports-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '업로드 배치 작업대',
  description:
    '선택한 업로드 배치의 행별 거래 유형, 연결 자금수단, 수집 적용 결과를 검토합니다.'
});

export default async function ImportsWorkbenchRoute({
  params
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  return <ImportsPage mode="detail" selectedBatchId={batchId} />;
}
