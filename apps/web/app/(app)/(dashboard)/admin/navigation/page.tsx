import { AdminNavigationPage } from '@/features/admin/admin-navigation-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '메뉴 / 권한',
  description:
    '사이드바 메뉴 구조와 메뉴별 접근 역할을 확인하는 권한 운영 화면입니다.'
});

export default function AdminNavigationRoutePage() {
  return <AdminNavigationPage />;
}
