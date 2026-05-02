import { OperationsSystemStatusPage } from '@/features/operations/operations-system-status-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '시스템 상태',
  description:
    '서비스 응답, 운영 상태, 시스템 점검 기준을 확인하는 운영 상태 화면입니다.'
});

export default function OperationsStatusRoutePage() {
  return <OperationsSystemStatusPage />;
}
