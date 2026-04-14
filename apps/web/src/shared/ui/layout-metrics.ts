// Route-level screens should use these shared spacing values instead of
// introducing page-specific magic numbers.
export const appLayout = {
  mainPaddingY: { xs: 3, md: 4 } as const,
  pageGap: 3,
  sectionGap: 2.5,
  fieldGap: 2,
  cardPadding: { xs: 2.5, md: 3 } as const,
  cardGap: 2.5,
  cardDescriptionOffset: 0.75,
  pageHeaderGap: 2.5,
  pageHeaderPadding: { xs: 2.5, md: 3 } as const,
  pageHeaderTitleOffset: 0.75,
  pageHeaderDescriptionOffset: 1.25,
  pageHeaderActionGap: 1,
  pageHeaderBadgeGap: 1,
  pageHeaderMetaGap: 1.5,
  pageHeaderSurfaceRadius: 5,
  pageHeaderContentMaxWidth: 760,
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
