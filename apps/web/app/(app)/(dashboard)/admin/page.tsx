import { AdminHomePage } from '@/features/admin/admin-home-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '관리자',
  description:
    '사용자, 사업장, 권한, 감사 로그를 한 곳에서 점검하는 관리자 시작 화면입니다.'
});

export default function AdminPage() {
  return <AdminHomePage />;
}
