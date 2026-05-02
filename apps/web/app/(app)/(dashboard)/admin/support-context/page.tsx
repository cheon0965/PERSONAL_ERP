import { AdminSupportContextPage } from '@/features/admin/admin-support-context-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '사업장 전환 / 지원 모드',
  description: '지원 작업을 위해 현재 관리자 세션의 사업장 운영 문맥을 선택하고 확인합니다.'
});

export default function AdminSupportContextRoutePage() {
  return <AdminSupportContextPage />;
}
