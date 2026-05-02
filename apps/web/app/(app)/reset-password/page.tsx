import { Suspense } from 'react';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '비밀번호 재설정',
  description:
    '인증된 재설정 링크로 새 비밀번호를 등록하고 계정 접근을 복구합니다.'
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  );
}
