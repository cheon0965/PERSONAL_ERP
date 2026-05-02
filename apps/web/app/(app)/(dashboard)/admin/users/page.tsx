import { AdminUsersPage } from '@/features/admin/admin-users-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '전체 사용자 관리',
  description:
    '전체 사용자 계정 상태와 관리자 권한을 확인하고 필요한 조치를 진행합니다.'
});

export default function AdminUsersRoutePage() {
  return <AdminUsersPage />;
}
