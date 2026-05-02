import { AdminLogsPage } from '@/features/admin/admin-logs-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '감사 로그',
  description:
    '사용자와 사업장 단위의 주요 변경 이력, 요청번호, 감사 메타데이터를 조회합니다.'
});

export default function AdminLogsRoutePage() {
  return <AdminLogsPage />;
}
