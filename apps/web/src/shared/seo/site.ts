export const publicSiteUrl = 'https://personalerp.theworkpc.com';

export const publicSiteSearchKeywords = [
  '월 운영 ERP',
  '월별 재무 운영',
  '개인 ERP',
  '개인사업자 ERP',
  '1인 사업자 ERP',
  '소상공인 ERP',
  '개인사업자 장부관리',
  '1인 사업자 장부관리',
  '소상공인 장부관리',
  '프리랜서 장부관리',
  '자영업자 장부관리',
  '월마감 관리',
  '소상공인 월마감',
  '개인사업자 월마감',
  '전표 관리',
  '전표 기반 회계',
  '수집 거래 관리',
  '은행 거래 업로드',
  '카드 거래 업로드',
  '거래내역 업로드',
  '재무제표 생성',
  '차기 이월',
  '현금흐름 관리',
  '운영 대시보드',
  '기준 데이터 관리'
] as const;

export const publicSiteUseCases = [
  {
    title: '개인사업자 장부관리',
    searchText: '개인사업자 장부관리 · 1인 사업자 ERP',
    description:
      '통장, 카드, 현금 거래 후보를 월별 운영 흐름으로 모아 개인사업자 장부 정리 기준을 세웁니다.'
  },
  {
    title: '소상공인 월마감',
    searchText: '소상공인 월마감 · 자영업자 월마감',
    description:
      '운영 월 시작, 수집 거래 검토, 전표 확정, 월 마감, 차기 이월을 한 흐름으로 이어 봅니다.'
  },
  {
    title: '은행·카드 거래 업로드',
    searchText: '거래내역 업로드 · 카드 명세 관리',
    description:
      '은행과 카드 명세 행을 업로드 배치로 관리하고 필요한 행만 수집 거래로 승격합니다.'
  },
  {
    title: '전표 기반 재무 운영',
    searchText: '전표 관리 · 전표 기반 회계',
    description:
      '검토가 끝난 수집 거래를 공식 전표로 확정해 운영 판단용 숫자와 보고 기준 숫자를 구분합니다.'
  },
  {
    title: '개인사업자 재무제표',
    searchText: '재무제표 생성 · 월별 손익 확인',
    description:
      '잠금된 월의 공식 재무제표와 운영 중 대시보드 숫자를 분리해 월별 흐름을 확인합니다.'
  },
  {
    title: '현금흐름과 다음 달 전망',
    searchText: '현금흐름 관리 · 차기 이월',
    description:
      '현재 잔액, 남은 계획 지출, 안전 잉여, 다음 달 이월 기준을 함께 보며 운영 여력을 점검합니다.'
  }
] as const;

export const publicSiteFaqs = [
  {
    question: 'PERSONAL ERP는 어떤 사람을 위한 프로젝트인가요?',
    answer:
      '1인 사업자, 소상공인, 프리랜서, 자영업자처럼 매달 거래를 모으고 장부를 정리해야 하는 작은 사업 운영자를 기준으로 만든 월별 재무 운영 ERP입니다.'
  },
  {
    question: '개인사업자 장부관리와 어떤 점이 연결되나요?',
    answer:
      '은행·카드 거래 업로드, 수집 거래 검토, 전표 확정, 월 마감, 재무제표, 차기 이월을 한 흐름으로 연결해 개인사업자 장부 정리 과정을 화면에서 따라갈 수 있게 했습니다.'
  },
  {
    question: '소상공인 월마감 업무에 어떻게 도움이 되나요?',
    answer:
      '운영 월을 열고 거래 후보를 모은 뒤 전표로 확정하고, 월 마감과 다음 달 전망까지 이어지는 상태를 대시보드와 보고 화면에서 구분해 확인할 수 있습니다.'
  },
  {
    question: '세무 신고나 회계 자문을 대신하나요?',
    answer:
      '아닙니다. PERSONAL ERP는 장부 정리와 내부 운영 판단을 돕는 포트폴리오 프로젝트이며, 세무·회계·법률 자문이나 신고 대행을 대신하지 않습니다.'
  }
] as const;

export const publicSiteMetadata = {
  name: 'PERSONAL ERP',
  description:
    '1인 사업자와 소상공인을 위한 월별 재무 운영 ERP. 개인사업자 장부관리, 거래내역 업로드, 전표, 월마감, 재무제표, 차기 이월을 한 흐름으로 정리합니다.'
} as const;

export function buildPublicHomeStructuredData() {
  const keywordText = publicSiteSearchKeywords.join(', ');

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${publicSiteUrl}/#website`,
        name: publicSiteMetadata.name,
        url: publicSiteUrl,
        inLanguage: 'ko-KR',
        description: publicSiteMetadata.description,
        keywords: keywordText
      },
      {
        '@type': 'WebPage',
        '@id': `${publicSiteUrl}/#webpage`,
        url: publicSiteUrl,
        name: 'PERSONAL ERP | 개인사업자 월 운영 ERP',
        isPartOf: {
          '@id': `${publicSiteUrl}/#website`
        },
        inLanguage: 'ko-KR',
        description: publicSiteMetadata.description,
        keywords: keywordText,
        about: publicSiteUseCases.map((useCase) => ({
          '@type': 'Thing',
          name: useCase.title,
          description: useCase.description
        }))
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${publicSiteUrl}/#software`,
        name: publicSiteMetadata.name,
        alternateName: [
          '개인 ERP',
          '월 운영 ERP',
          '개인사업자 ERP',
          '소상공인 ERP'
        ],
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: publicSiteUrl,
        inLanguage: 'ko-KR',
        description: publicSiteMetadata.description,
        keywords: keywordText,
        featureList: [
          '월 운영 대시보드',
          '은행·카드 거래내역 업로드',
          '수집 거래 검토',
          '전표 확정',
          '월 마감',
          '재무제표 생성',
          '차기 이월',
          '현금흐름 전망'
        ],
        audience: [
          {
            '@type': 'Audience',
            audienceType: '1인 사업자'
          },
          {
            '@type': 'Audience',
            audienceType: '소상공인'
          },
          {
            '@type': 'Audience',
            audienceType: '프리랜서'
          }
        ],
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'KRW',
          availability: 'https://schema.org/InStock'
        }
      },
      {
        '@type': 'FAQPage',
        '@id': `${publicSiteUrl}/#faq`,
        inLanguage: 'ko-KR',
        mainEntity: publicSiteFaqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer
          }
        }))
      }
    ]
  };
}
