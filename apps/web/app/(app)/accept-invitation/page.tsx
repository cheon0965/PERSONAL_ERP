import { Suspense } from 'react';
import { AcceptInvitationPage } from '@/features/auth/accept-invitation-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitationPage />
    </Suspense>
  );
}
