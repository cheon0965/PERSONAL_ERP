import { AuthGuard } from '@/shared/auth/auth-guard';
import { AppShell } from '@/shared/layout/app-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
