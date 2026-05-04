'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SettingsSuggestRoundedIcon from '@mui/icons-material/SettingsSuggestRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { BrandLogo } from '@/shared/brand/brand-logo';
import { publicSiteUrl } from '@/shared/seo/site';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';

const featureCards = [
  {
    title: '운영 대시보드',
    description:
      '현재 운영 월의 준비 상태, 최근 흐름, 처리할 예외를 한 화면에서 확인합니다.',
    icon: DashboardRoundedIcon,
    color: brandTokens.palette.primary
  },
  {
    title: '수집 거래',
    description:
      '수기 입력, 업로드, 반복 규칙에서 들어온 거래를 검토하고 전표 준비 상태로 정리합니다.',
    icon: ReceiptLongRoundedIcon,
    color: brandTokens.palette.secondaryDark
  },
  {
    title: '전표 확정',
    description:
      '준비된 수집 거래를 공식 전표로 확정해 회계 기준 데이터와 운영 기록을 분리합니다.',
    icon: AssessmentRoundedIcon,
    color: brandTokens.palette.info
  },
  {
    title: '업로드 배치',
    description:
      '은행·카드 명세 행을 검토하고 필요한 행만 수집 거래로 승격합니다.',
    icon: UploadFileRoundedIcon,
    color: brandTokens.palette.warning
  },
  {
    title: '월 운영과 마감',
    description:
      '운영 월 시작, 닫기, 재개방 흐름을 기준으로 데이터 입력 범위를 안정적으로 관리합니다.',
    icon: CalendarMonthRoundedIcon,
    color: brandTokens.palette.secondary
  },
  {
    title: '기준 데이터',
    description:
      '자금수단, 카테고리, 거래 유형을 먼저 맞춰 이후 거래·전표 흐름을 흔들리지 않게 합니다.',
    icon: SettingsSuggestRoundedIcon,
    color: brandTokens.palette.primaryDark
  }
];

const workflowSteps = [
  {
    label: '운영 월 시작',
    value: '이번 달 입력 범위 고정'
  },
  {
    label: '자료 수집',
    value: '업로드·반복·수기 입력 통합'
  },
  {
    label: '거래 검토',
    value: '분류와 자금수단 보완'
  },
  {
    label: '전표 확정',
    value: '공식 회계 기록 생성'
  },
  {
    label: '마감과 전망',
    value: '월 종료 후 다음 기간 준비'
  }
];

const strengths = [
  '업무 흐름이 월 운영 기준으로 이어집니다.',
  '수집 거래와 공식 전표의 책임 경계가 분명합니다.',
  '기준 데이터 준비 상태를 먼저 알려 입력 오류를 줄입니다.',
  '업로드, 반복 규칙, 계획 항목이 같은 회계 흐름으로 모입니다.'
];

const previewRows = [
  {
    title: 'IM뱅크 카드 승인',
    status: '전표 준비',
    amount: '128,000원'
  },
  {
    title: '정기 보험료',
    status: '검토됨',
    amount: '86,400원'
  },
  {
    title: '스마트스토어 매출',
    status: '확정 완료',
    amount: '1,240,000원'
  }
];

const marketingBorderColor = alpha(brandTokens.palette.primary, 0.08);
const marketingBorderStrong = alpha(brandTokens.palette.primary, 0.1);
const marketingGlassBackground = alpha(brandTokens.palette.surface, 0.92);
const marketingOverlayBackground = {
  xs: alpha(brandTokens.palette.background, 0.88),
  md: alpha(brandTokens.palette.background, 0.48)
} as const;
const marketingReadableMutedText = '#34456c';
const marketingReadableSubtleText = '#42557d';
const marketingStrengthBackground = `linear-gradient(160deg, ${brandTokens.palette.primaryDark} 0%, ${brandTokens.palette.primary} 58%, ${brandTokens.palette.secondaryDark} 100%)`;
const publicDemoEmail = 'demo@example.com';
const publicDemoPassword = 'Demo1234!';

export function PublicHomePage() {
  const router = useRouter();
  const { status } = useAuthSession();

  React.useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard' as Route);
    }
  }, [router, status]);

  if (status === 'authenticated') {
    return <PublicHomeLoading />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: brandTokens.palette.background,
        color: 'text.primary'
      }}
    >
      <LandingHeader />
      <Box component="main">
        <HeroSection />
        <WorkflowSection />
        <FeatureSection />
        <StrengthSection />
        <CallToActionSection />
      </Box>
    </Box>
  );
}

function PublicHomeLoading() {
  return (
    <Stack
      minHeight="100vh"
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{ bgcolor: brandTokens.palette.background }}
    >
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        진입 경로를 확인하고 있습니다.
      </Typography>
    </Stack>
  );
}

function LandingHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        borderBottom: '1px solid',
        borderColor: marketingBorderColor,
        bgcolor: marketingGlassBackground,
        backdropFilter: 'blur(16px)'
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          sx={{ minHeight: 68 }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer'
            }}
          >
            <BrandLogo priority width="clamp(156px, 18vw, 190px)" />
          </Box>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            <Button
              color="inherit"
              size="small"
              onClick={() => smoothScrollTo('workflow')}
            >
              업무 흐름
            </Button>
            <Button
              color="inherit"
              size="small"
              onClick={() => smoothScrollTo('features')}
            >
              주요 기능
            </Button>
            <Button
              color="inherit"
              size="small"
              onClick={() => smoothScrollTo('strengths')}
            >
              장점
            </Button>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              href="/login"
              variant="outlined"
              size="small"
              startIcon={<LoginRoundedIcon />}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              로그인
            </Button>
            <Button
              component={Link}
              href="/register"
              variant="contained"
              size="small"
              startIcon={<PersonAddAltRoundedIcon />}
            >
              시작하기
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function HeroSection() {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: { xs: 'auto', md: 'calc(84svh - 68px)' },
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: marketingBorderColor
      }}
    >
      <HeroOperationsScene />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: marketingOverlayBackground
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Stack
          spacing={3}
          sx={{
            maxWidth: 700,
            py: { xs: 4.5, md: 9 }
          }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              label="월 운영 ERP"
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label="수집 거래부터 전표까지"
              size="small"
              sx={{
                bgcolor: brandTokens.palette.secondarySoft,
                color: brandTokens.palette.secondaryDark
              }}
            />
          </Stack>

          <Stack spacing={1.75}>
            <Box component="h1" sx={{ m: 0, lineHeight: 0 }}>
              <BrandLogo priority width="clamp(280px, 46vw, 620px)" />
            </Box>
            <Typography
              variant="h5"
              sx={{
                maxWidth: 620,
                fontWeight: 700,
                fontSize: { xs: '1.22rem', md: '1.75rem' },
                lineHeight: 1.35,
                letterSpacing: 0,
                color: brandTokens.palette.text
              }}
            >
              소규모 사업자의 월 운영, 수집 거래, 전표, 마감을 한 흐름으로
              정리합니다.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                maxWidth: 600,
                color: marketingReadableMutedText,
                lineHeight: 1.8
              }}
            >
              흩어진 거래 후보를 모으고, 기준 데이터를 점검하고, 공식 전표와 월
              마감까지 이어지는 운영 포털입니다. 지금 필요한 업무만 빠르게
              확인할 수 있도록 조용하고 밀도 있게 구성했습니다.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button
              component={Link}
              href="/register"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ px: 3 }}
            >
              무료로 시작하기
            </Button>
            <Button
              component={Link}
              href="/login"
              variant="outlined"
              size="large"
              startIcon={<LoginRoundedIcon />}
              sx={{ px: 3, bgcolor: alpha(brandTokens.palette.surface, 0.78) }}
            >
              기존 계정 로그인
            </Button>
          </Stack>

          <PublicDemoNotice />

          <Grid container spacing={1.5} sx={{ maxWidth: 620 }}>
            {[
              ['운영 기준', '월 단위 관리'],
              ['회계 흐름', '거래에서 전표'],
              ['입력 방식', '수기·업로드·반복']
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 4 }}>
                <Box
                  sx={{
                    p: { xs: 1.15, sm: 1.5 },
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: marketingBorderColor,
                    bgcolor: alpha(brandTokens.palette.surface, 0.78)
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: marketingReadableSubtleText }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: brandTokens.palette.primaryDark }}
                    fontWeight={800}
                  >
                    {value}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}

function PublicDemoNotice() {
  return (
    <Stack
      spacing={1.25}
      sx={{
        maxWidth: 620,
        p: { xs: 1.75, sm: 2 },
        borderRadius: '8px',
        border: '1px solid',
        borderColor: alpha(brandTokens.palette.primaryBright, 0.2),
        bgcolor: alpha(brandTokens.palette.surface, 0.86),
        boxShadow: '0 14px 34px rgba(6, 34, 111, 0.08)'
      }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label="공개 체험 운영 중" color="success" size="small" />
        <Chip label="검색 노출 대상 URL" color="primary" size="small" />
      </Stack>
      <Stack spacing={0.4}>
        <Typography variant="subtitle2" fontWeight={900}>
          실제 체험 URL
        </Typography>
        <Typography
          component="a"
          href={publicSiteUrl}
          variant="body1"
          sx={{
            color: brandTokens.palette.primary,
            fontWeight: 900,
            textDecoration: 'none',
            wordBreak: 'break-all',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          {publicSiteUrl}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        sx={{ color: marketingReadableMutedText, lineHeight: 1.7 }}
      >
        데모 로그인은 {publicDemoEmail} / {publicDemoPassword} 계정으로 바로
        확인할 수 있습니다.
      </Typography>
    </Stack>
  );
}

function HeroOperationsScene() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          width: { xs: 560, md: 780 },
          right: { xs: -480, sm: -280, md: -120, lg: 12 },
          top: { xs: 106, sm: 72, md: 86 },
          opacity: { xs: 0.58, md: 0.96 }
        }}
      >
        <Box
          sx={{
            borderRadius: '8px',
            border: '1px solid',
            borderColor: marketingBorderStrong,
            bgcolor: alpha(brandTokens.palette.surface, 0.94),
            boxShadow: '0 24px 70px rgba(6, 23, 79, 0.12)',
            overflow: 'hidden'
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: marketingBorderColor,
              bgcolor: brandTokens.palette.surface
            }}
          >
            <Stack direction="row" spacing={0.75}>
              {[
                brandTokens.palette.error,
                brandTokens.palette.warning,
                brandTokens.palette.secondaryDark
              ].map((color) => (
                <Box
                  key={color}
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: color
                  }}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              2026-04 운영 월
            </Typography>
          </Stack>

          <Grid container>
            <Grid
              size={{ xs: 4 }}
              sx={{
                p: 2,
                bgcolor: brandTokens.palette.surfaceSoft,
                borderRight: '1px solid',
                borderColor: marketingBorderColor,
                minHeight: 420
              }}
            >
              <Stack spacing={1.2}>
                {['대시보드', '수집 거래', '전표 조회', '월 마감'].map(
                  (item, index) => (
                    <Stack
                      key={item}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{
                        p: 1,
                        borderRadius: '8px',
                        bgcolor:
                          index === 1
                            ? alpha(brandTokens.palette.secondary, 0.16)
                            : 'transparent',
                        color:
                          index === 1
                            ? brandTokens.palette.primary
                            : brandTokens.palette.textMuted
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor:
                            index === 1
                              ? brandTokens.palette.primary
                              : brandTokens.palette.border
                        }}
                      />
                      <Typography variant="caption" fontWeight={800}>
                        {item}
                      </Typography>
                    </Stack>
                  )
                )}
              </Stack>
            </Grid>

            <Grid size={{ xs: 8 }} sx={{ p: 2.25, minHeight: 420 }}>
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="h6" fontWeight={900}>
                      수집 거래 작업대
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      검토할 거래와 전표 준비 상태를 함께 확인
                    </Typography>
                  </Box>
                  <Chip label="전표 준비 7건" size="small" color="success" />
                </Stack>

                <Grid container spacing={1.25}>
                  {[
                    [
                      '이번 달 거래',
                      '128건',
                      brandTokens.palette.primarySoft,
                      brandTokens.palette.primary
                    ],
                    [
                      '업로드 대기',
                      '14행',
                      alpha(brandTokens.palette.warning, 0.16),
                      brandTokens.palette.warning
                    ],
                    [
                      '확정 전표',
                      '92건',
                      brandTokens.palette.secondarySoft,
                      brandTokens.palette.secondaryDark
                    ]
                  ].map(([label, value, bgColor, textColor]) => (
                    <Grid key={label} size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: 1.4,
                          borderRadius: '8px',
                          bgcolor: bgColor,
                          color: textColor
                        }}
                      >
                        <Typography variant="caption">{label}</Typography>
                        <Typography variant="h6" fontWeight={900}>
                          {value}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Stack spacing={1}>
                  {previewRows.map((row) => (
                    <Stack
                      key={row.title}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                      sx={{
                        p: 1.25,
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: marketingBorderColor,
                        bgcolor: brandTokens.palette.surface
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: alpha(brandTokens.palette.primary, 0.1),
                            color: brandTokens.palette.primary
                          }}
                        >
                          <ReceiptLongRoundedIcon sx={{ fontSize: 17 }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" fontWeight={900}>
                            {row.title}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {row.status}
                          </Typography>
                        </Box>
                      </Stack>
                      <Typography variant="caption" fontWeight={900}>
                        {row.amount}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}

function WorkflowSection() {
  return (
    <Box
      id="workflow"
      component="section"
      sx={{
        py: { xs: 6, md: 8 },
        bgcolor: brandTokens.palette.surface,
        borderBottom: '1px solid',
        borderColor: marketingBorderColor
      }}
    >
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="WORKFLOW"
          title="월 운영이 끝까지 이어지는 구조"
          description="입력 화면을 늘리는 대신 실제 업무가 진행되는 순서대로 데이터를 연결합니다."
        />

        <Grid container spacing={1.5} sx={{ mt: 3 }}>
          {workflowSteps.map((step, index) => (
            <Grid key={step.label} size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Stack
                spacing={1.25}
                sx={{
                  height: '100%',
                  p: 2,
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: marketingBorderColor,
                  bgcolor:
                    index % 2 === 0
                      ? brandTokens.palette.surfaceSoft
                      : brandTokens.palette.surfaceMuted
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: brandTokens.palette.primary,
                    color: 'common.white',
                    fontWeight: 900
                  }}
                >
                  {index + 1}
                </Box>
                <Typography variant="subtitle1" fontWeight={900}>
                  {step.label}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.65 }}
                >
                  {step.value}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

function FeatureSection() {
  return (
    <Box
      id="features"
      component="section"
      sx={{ py: { xs: 6, md: 8 }, bgcolor: brandTokens.palette.background }}
    >
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="FEATURES"
          title="처음부터 업무 화면으로 작동하는 기능들"
          description="대시보드, 기준 데이터, 거래 검토, 전표 확정, 월 마감까지 개인 장부 운영에 필요한 핵심 기능을 한 제품 안에 묶었습니다."
        />

        <Grid container spacing={2} sx={{ mt: 3 }}>
          {featureCards.map((feature) => {
            const FeatureIcon = feature.icon;

            return (
              <Grid key={feature.title} size={{ xs: 12, sm: 6, md: 4 }}>
                <Stack
                  spacing={2}
                  sx={{
                    height: '100%',
                    p: appLayout.cardPadding,
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: marketingBorderColor,
                    bgcolor: brandTokens.palette.surface,
                    boxShadow: '0 12px 30px rgba(6, 23, 79, 0.06)'
                  }}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: feature.color,
                      bgcolor: alpha(feature.color, 0.12)
                    }}
                  >
                    <FeatureIcon fontSize="small" />
                  </Box>
                  <Stack spacing={0.75}>
                    <Typography variant="h6" fontWeight={900}>
                      {feature.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.7 }}
                    >
                      {feature.description}
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
}

function StrengthSection() {
  return (
    <Box
      id="strengths"
      component="section"
      sx={{
        py: { xs: 6, md: 8 },
        bgcolor: marketingStrengthBackground,
        color: brandTokens.palette.primaryDark
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={1.5}>
              <Typography
                variant="overline"
                sx={{ color: brandTokens.palette.primary, fontWeight: 800 }}
              >
                WHY PERSONAL ERP
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: '2rem', md: '2.65rem' },
                  lineHeight: 1.12,
                  letterSpacing: 0,
                  color: brandTokens.palette.primaryDark
                }}
              >
                작은 사업자의 실제 운영 흐름에 맞춘 ERP
              </Typography>
              <Typography
                variant="body1"
                sx={{ color: marketingReadableMutedText, lineHeight: 1.8 }}
              >
                화면은 가볍게, 데이터 경계는 단단하게 가져갑니다. 거래를
                입력하는 순간부터 월 마감 이후의 보고와 전망까지 같은 기준으로
                이어집니다.
              </Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Grid container spacing={1.5}>
              {strengths.map((strength) => (
                <Grid key={strength} size={{ xs: 12, sm: 6 }}>
                  <Stack
                    direction="row"
                    spacing={1.25}
                    alignItems="flex-start"
                    sx={{
                      height: '100%',
                      p: 2,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: marketingBorderColor,
                      bgcolor: alpha(brandTokens.palette.surface, 0.84)
                    }}
                  >
                    <CheckCircleRoundedIcon
                      sx={{
                        mt: 0.25,
                        color: brandTokens.palette.secondary,
                        fontSize: 20
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: brandTokens.palette.primaryDark,
                        lineHeight: 1.65
                      }}
                    >
                      {strength}
                    </Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function CallToActionSection() {
  return (
    <Box
      component="section"
      sx={{ py: { xs: 6, md: 8 }, bgcolor: brandTokens.palette.surface }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: '8px',
            border: '1px solid',
            borderColor: marketingBorderColor,
            bgcolor: brandTokens.palette.surfaceSoft
          }}
        >
          <Stack spacing={1}>
            <Typography variant="h4" fontWeight={900} letterSpacing={0}>
              첫 운영 월부터 정리해보세요.
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 620, lineHeight: 1.75 }}
            >
              워크스페이스를 만들고 기준 데이터를 준비하면, 수집 거래와 전표
              확정 흐름을 바로 시작할 수 있습니다.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button
              component={Link}
              href="/register"
              variant="contained"
              size="large"
              startIcon={<PersonAddAltRoundedIcon />}
            >
              회원가입
            </Button>
            <Button
              component={Link}
              href="/login"
              variant="outlined"
              size="large"
              startIcon={<LoginRoundedIcon />}
            >
              로그인
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Stack spacing={1} sx={{ maxWidth: 760 }}>
      <Typography
        variant="overline"
        color="primary"
        sx={{ fontWeight: 900, letterSpacing: 0 }}
      >
        {eyebrow}
      </Typography>
      <Typography
        variant="h3"
        sx={{
          fontWeight: 900,
          fontSize: { xs: '2rem', md: '2.65rem' },
          lineHeight: 1.14,
          letterSpacing: 0
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ lineHeight: 1.8 }}
      >
        {description}
      </Typography>
    </Stack>
  );
}

const HEADER_HEIGHT = 68;

function smoothScrollTo(id: string) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  const top =
    element.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;

  window.scrollTo({ top, behavior: 'smooth' });
}
