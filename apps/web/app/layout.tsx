import type { Metadata, Viewport } from 'next';
import './globals.css';

const appName = 'PERSONAL ERP';
const appDescription = '1인 사업자·소상공인을 위한 월 운영 ERP';

export const viewport: Viewport = {
  themeColor: '#06226f'
};

export const metadata: Metadata = {
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`
  },
  description: appDescription,
  keywords: [
    '월 운영 ERP',
    '개인 ERP',
    '소상공인 ERP',
    '수집 거래',
    '전표',
    '월 마감'
  ],
  creator: appName,
  publisher: appName,
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [{ url: '/logo-icon.png', type: 'image/png' }],
    shortcut: [{ url: '/logo-icon.png', type: 'image/png' }],
    apple: [{ url: '/logo-icon.png', type: 'image/png' }]
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: appName,
    title: appName,
    description: appDescription
  },
  twitter: {
    card: 'summary',
    title: appName,
    description: appDescription
  }
};

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
