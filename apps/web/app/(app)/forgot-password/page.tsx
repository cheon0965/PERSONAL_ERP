import { Suspense } from 'react';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPage />
    </Suspense>
  );
}
