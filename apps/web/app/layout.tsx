import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Personal ERP Starter',
  description: 'Portfolio-ready personal cash-flow ERP starter'
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
