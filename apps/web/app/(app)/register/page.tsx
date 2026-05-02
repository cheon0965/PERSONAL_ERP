import { Suspense } from 'react';
import { RegisterPage } from '@/features/auth/register-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '회원가입',
  description: '새 계정과 사업장 기준을 만들어 월 운영 ERP 사용을 시작합니다.'
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterPage />
    </Suspense>
  );
}
