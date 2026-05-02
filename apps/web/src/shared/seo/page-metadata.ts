import type { Metadata } from 'next';

const productName = 'PERSONAL ERP';

type PageMetadataInput = {
  title: string;
  description: string;
  robots?: Metadata['robots'];
};

export function createPageMetadata({
  title,
  description,
  robots = {
    index: false,
    follow: false
  }
}: PageMetadataInput): Metadata {
  const socialTitle = `${title} | ${productName}`;

  // 운영형 ERP 화면은 인증 뒤에서 쓰는 페이지가 대부분이라 기본값은 noindex로 둔다.
  // 공개 포트폴리오/랜딩 성격 페이지가 필요할 때만 호출부에서 robots를 명시적으로 연다.
  return {
    title,
    description,
    robots,
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: productName,
      title: socialTitle,
      description
    },
    twitter: {
      card: 'summary',
      title: socialTitle,
      description
    }
  };
}
