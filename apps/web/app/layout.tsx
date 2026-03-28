import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Personal ERP',
  description: '월별 재무 운영을 위한 개인 ERP'
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
