import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PERSONAL ERP',
  description: '1인 사업자·소상공인을 위한 월 운영 ERP',
  icons: {
    icon: '/logo-icon.png',
    shortcut: '/logo-icon.png',
    apple: '/logo-icon.png'
  }
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
