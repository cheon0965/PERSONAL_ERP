import { OperationsChecklistPage } from '@/features/operations/operations-checklist-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '운영 체크리스트',
  description: '월 운영과 배포 전후에 확인해야 할 점검 항목과 완료 상태를 관리합니다.'
});

export default function OperationsChecklistRoutePage() {
  return <OperationsChecklistPage />;
}
