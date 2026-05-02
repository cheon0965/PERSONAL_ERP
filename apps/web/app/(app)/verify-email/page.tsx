import { Suspense } from 'react';
import { VerifyEmailPage } from '@/features/auth/verify-email-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '이메일 인증',
  description: '계정 이메일 인증 상태를 확인하고 PERSONAL ERP 사용 준비를 완료합니다.'
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPage />
    </Suspense>
  );
}
