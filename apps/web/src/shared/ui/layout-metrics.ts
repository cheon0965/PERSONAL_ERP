// 라우트 단위 화면은 페이지별 매직 넘버를 새로 두지 말고
// 이 공통 간격 값을 사용한다.
export const appLayout = {
  mainPaddingY: { xs: 2.5, md: 3 } as const,
  pageGap: 3,
  sectionGap: 2.5,
  fieldGap: 2,
  cardPadding: { xs: 2.5, md: 3 } as const,
  cardGap: 2.5,
  cardDescriptionOffset: 0.75,
  pageHeaderGap: 1.25,
  pageHeaderPadding: { xs: 1.75, md: 2.25 } as const,
  pageHeaderTitleOffset: 0.25,
  pageHeaderDescriptionOffset: 0.5,
  pageHeaderActionGap: 0.75,
  pageHeaderBadgeGap: 0.75,
  pageHeaderMetaGap: 0.75,
  pageHeaderSurfaceRadius: 3.5,
  pageHeaderContentMaxWidth: 720,
  authPagePaddingY: { xs: 4, md: 6 } as const,
  authGridGap: 3,
  authSurfacePadding: { xs: 3, md: 4 } as const,
  authSurfaceGap: 3,
  authMetricGap: 1.5,
  authFeatureGap: 2,
  dashboardHeroPadding: { xs: 2.5, md: 3 } as const,
  dashboardHeroGap: 2,
  dashboardHeroMetricGap: 1.25
} as const;
