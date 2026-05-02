import { Suspense } from 'react';
import { AcceptInvitationPage } from '@/features/auth/accept-invitation-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '초대 수락',
  description: '사업장 초대 링크를 확인하고 멤버 계정 연결을 완료합니다.'
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitationPage />
    </Suspense>
  );
}
