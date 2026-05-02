import { AdminMembersPage } from '@/features/admin/admin-members-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '회원 관리',
  description: '사업장 멤버의 역할, 상태, 초대 흐름을 점검하고 권한 변경 이력을 추적합니다.'
});

export default function AdminMembersRoutePage() {
  return <AdminMembersPage />;
}
