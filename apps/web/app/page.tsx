import type { Metadata } from 'next';
import { PublicHomePage } from '@/features/marketing/public-home-page';
import { AppProviders } from '@/shared/providers/app-providers';

const homeTitle = 'PERSONAL ERP | 월 운영 ERP';
const homeDescription =
  '수집 거래, 전표, 월 마감, 업로드, 기준 데이터를 한 흐름으로 연결하는 개인·소상공인 ERP';

export const metadata: Metadata = {
  title: {
    absolute: homeTitle
  },
  description: homeDescription,
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: homeTitle,
    description: homeDescription
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
