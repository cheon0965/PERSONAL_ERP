import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { CspNonceProvider } from '@/shared/security/csp-nonce';
import { publicSiteMetadata, publicSiteUrl } from '@/shared/seo/site';
import './globals.css';

const appName = publicSiteMetadata.name;
const appDescription = publicSiteMetadata.description;

export const viewport: Viewport = {
  themeColor: '#06226f'
};

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
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
  alternates: {
    canonical: '/'
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: appName,
    title: appName,
    description: appDescription,
    url: publicSiteUrl,
    images: [
      {
        url: '/logo-wordmark.png',
        width: 2000,
        height: 666,
        alt: `${appName} 로고`
      }
    ]
  },
  twitter: {
    card: 'summary',
    title: appName,
    description: appDescription,
    images: ['/logo-wordmark.png']
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="ko">
      <body>
        <CspNonceProvider nonce={nonce}>{children}</CspNonceProvider>
      </body>
    </html>
  );
}
