import type { Metadata } from 'next';
import { PublicHomePage } from '@/features/marketing/public-home-page';
import { AppProviders } from '@/shared/providers/app-providers';
import { publicSiteMetadata, publicSiteUrl } from '@/shared/seo/site';

const homeTitle = 'PERSONAL ERP | 월 운영 ERP';
const homeDescription = publicSiteMetadata.description;

export const metadata: Metadata = {
  title: {
    absolute: homeTitle
  },
  description: homeDescription,
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
    url: publicSiteUrl
  },
  twitter: {
    card: 'summary',
    title: homeTitle,
    description: homeDescription
  }
};

export default function HomePage() {
  return (
    <AppProviders>
      <PublicHomePage />
    </AppProviders>
  );
}
