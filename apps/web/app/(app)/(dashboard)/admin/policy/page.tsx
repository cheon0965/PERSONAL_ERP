import { AdminPolicyPage } from '@/features/admin/admin-policy-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '권한 정책',
  description:
    '역할별 허용 범위와 권한 운영 기준을 확인하고 메뉴 권한과 함께 검토합니다.'
});

export default function AdminPolicyRoutePage() {
  return <AdminPolicyPage />;
}
