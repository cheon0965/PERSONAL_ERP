import { Suspense } from 'react';
import { LoginPage } from '@/features/auth/login-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '로그인',
  description: 'PERSONAL ERP 계정으로 로그인해 월 운영 작업 공간에 접속합니다.'
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
