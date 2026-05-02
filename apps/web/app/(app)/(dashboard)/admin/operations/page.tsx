import { AdminOperationsStatusPage } from '@/features/admin/admin-operations-status-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '전체 관리자 운영 상태',
  description:
    '사업장 운영 지표, 보안 이벤트, 감사 흐름을 전체 관리자 관점에서 점검합니다.'
});

export default function AdminOperationsRoutePage() {
  return <AdminOperationsStatusPage />;
}
