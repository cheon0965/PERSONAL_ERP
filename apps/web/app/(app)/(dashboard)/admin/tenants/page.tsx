import { AdminTenantsPage } from '@/features/admin/admin-tenants-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '사업장 관리',
  description:
    '사업장 상태, 기본 장부, 연결 멤버 구성을 전체 관리자 기준으로 확인합니다.'
});

export default function AdminTenantsRoutePage() {
  return <AdminTenantsPage />;
}
