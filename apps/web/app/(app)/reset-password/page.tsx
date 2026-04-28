import { Suspense } from 'react';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  );
}
