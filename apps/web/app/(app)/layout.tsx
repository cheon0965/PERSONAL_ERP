import type { Metadata } from 'next';
import { AppProviders } from '@/shared/providers/app-providers';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
