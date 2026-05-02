import { OperationsImportStatusPage } from '@/features/operations/operations-import-status-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '업로드 운영 현황',
  description: '업로드 배치 처리 상태, 실패 행, 미수집 행을 운영 관점에서 점검합니다.'
});

export default function OperationsImportsRoutePage() {
  return <OperationsImportStatusPage />;
}
