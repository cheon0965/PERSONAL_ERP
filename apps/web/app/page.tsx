import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PublicHomePage } from '@/features/marketing/public-home-page';
import { AppProviders } from '@/shared/providers/app-providers';
import {
  buildPublicHomeStructuredData,
  publicSiteMetadata,
  publicSiteSearchKeywords,
  publicSiteUrl
} from '@/shared/seo/site';

const homeTitle = 'PERSONAL ERP | 개인사업자·소상공인 월 운영 ERP';
const homeDescription = publicSiteMetadata.description;
const homeImageAlt = 'PERSONAL ERP 월 운영 대시보드 실제 화면';
const homeKeywords = [...publicSiteSearchKeywords];

export const metadata: Metadata = {
  title: {
    absolute: homeTitle
  },
  description: homeDescription,
  keywords: homeKeywords,
  robots: {
    index: true,
    follow: true
  },
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    url: publicSiteUrl,
    type: 'website',
    locale: 'ko_KR',
    images: [
      {
        url: '/marketing-dashboard-screenshot.png',
        width: 1902,
        height: 840,
        alt: homeImageAlt
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: homeTitle,
    description: homeDescription,
    images: [
      {
        url: '/marketing-dashboard-screenshot.png',
        alt: homeImageAlt
      }
    ]
  }
};

function serializeStructuredData(
  data: ReturnType<typeof buildPublicHomeStructuredData>
) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function HomePage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(buildPublicHomeStructuredData())
        }}
      />
      <AppProviders>
        <PublicHomePage />
      </AppProviders>
    </>
  );
}
