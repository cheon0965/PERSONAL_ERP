import { AdminSecurityThreatsPage } from '@/features/admin/admin-security-threats-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '보안 위협 로그',
  description:
    '비정상 인증, 차단 이벤트, 보안 위협 징후를 관리자 기준으로 추적합니다.'
});

export default function AdminSecurityThreatsRoutePage() {
  return <AdminSecurityThreatsPage />;
}
