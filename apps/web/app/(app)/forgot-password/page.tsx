import { Suspense } from 'react';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '비밀번호 찾기',
  description: '가입 이메일을 확인하고 비밀번호 재설정 절차를 시작합니다.'
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPage />
    </Suspense>
  );
}
