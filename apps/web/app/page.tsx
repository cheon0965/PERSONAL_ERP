import type { Metadata } from 'next';
import { PublicHomePage } from '@/features/marketing/public-home-page';
import { AppProviders } from '@/shared/providers/app-providers';

export const metadata: Metadata = {
  title: 'PERSONAL ERP | 월 운영 ERP',
  description:
    '수집 거래, 전표, 월 마감, 업로드, 기준 데이터를 한 흐름으로 연결하는 개인·소상공인 ERP'
};

export default function HomePage() {
  return (
    <AppProviders>
      <PublicHomePage />
    </AppProviders>
  );
}
