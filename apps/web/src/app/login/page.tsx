import { Suspense } from 'react';
import { LoginPage } from '@/features/auth/login-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
