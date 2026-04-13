import { Suspense } from 'react';
import { RegisterPage } from '@/features/auth/register-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterPage />
    </Suspense>
  );
}
