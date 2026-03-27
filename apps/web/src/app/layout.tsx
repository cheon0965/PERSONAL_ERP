import type { Metadata } from 'next';
import { AuthProvider } from '@/shared/auth/auth-provider';
import { ThemeRegistry } from '@/shared/providers/theme-registry';
import { QueryProvider } from '@/shared/providers/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Personal ERP Starter',
  description: 'Portfolio-ready personal cash-flow ERP starter'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <ThemeRegistry>
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
