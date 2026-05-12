'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import GitHubIcon from '@mui/icons-material/GitHub';
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
import {
  demoLoginCredentials,
  demoLoginPath
} from '@/features/auth/demo-login';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { BrandLogo } from '@/shared/brand/brand-logo';
import { publicSiteFaqs, publicSiteUseCases } from '@/shared/seo/site';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';

const featureCards = [
  {
    title: '운영 대시보드',
    description:
      '현재 운영 월의 현금 잔액, 확정 지출, 남은 계획, 안전 여력을 빠르게 점검합니다.',
    icon: DashboardRoundedIcon,
    color: brandTokens.palette.primary
  },
  {
    title: '수집 거래',
    description:
      '은행·카드 업로드와 반복 규칙에서 들어온 거래 후보를 검토 가능한 작업 목록으로 모읍니다.',
    icon: ReceiptLongRoundedIcon,
    color: brandTokens.palette.secondaryDark
  },
  {
    title: '전표 확정',
    description:
      '검토가 끝난 거래를 공식 전표로 확정해 운영 기록과 보고 기준을 분리합니다.',
    icon: AssessmentRoundedIcon,
    color: brandTokens.palette.info
  },
  {
    title: '업로드 배치',
    description:
      '명세 파일의 행 단위 상태를 추적하고 필요한 행만 수집 거래로 승격합니다.',
    icon: UploadFileRoundedIcon,
    color: brandTokens.palette.warning
  },
  {
    title: '월 운영과 마감',
    description:
      '운영 월 시작, 마감, 재개방, 차기 이월까지 기간 단위 흐름을 안정적으로 관리합니다.',
    icon: CalendarMonthRoundedIcon,
    color: brandTokens.palette.secondary
  },
  {
    title: '기준 데이터',
    description:
      '자금수단, 카테고리, 계정 기준을 먼저 맞춰 이후 거래·전표 흐름을 흔들리지 않게 합니다.',
    icon: SettingsSuggestRoundedIcon,
    color: brandTokens.palette.primaryDark
  }
];

const workflowSteps = [
  {
    label: '운영 월 시작',
    value: '이번 달 입력 범위와 기준 잔액 고정'
  },
  {
    label: '자료 수집',
    value: '업로드·반복·수기 거래 후보 통합'
  },
  {
    label: '거래 검토',
    value: '분류, 자금수단, 전표 준비 상태 보완'
  },
  {
    label: '전표 확정',
    value: '공식 회계 기록과 조정 이력 생성'
  },
  {
    label: '마감과 전망',
    value: '재무제표, 차기 이월, 다음 달 전망 연결'
  }
];

const strengths = [
  '월별 입력, 검토, 확정, 마감 흐름이 한 화면 체계 안에서 이어집니다.',
  '수집 거래와 공식 전표의 책임 경계가 분명해 운영 판단과 보고를 섞지 않습니다.',
  '기준 데이터 준비 상태를 먼저 알려 반복 입력 오류와 마감 누락을 줄입니다.',
  '업로드, 반복 규칙, 계획 항목이 같은 전표 기반 회계 흐름으로 모입니다.'
];

const marketingBorderColor = alpha(brandTokens.palette.primary, 0.08);
const marketingGlassBackground = alpha(brandTokens.palette.surface, 0.92);
const marketingReadableMutedText = '#34456c';
const marketingReadableSubtleText = '#42557d';
const marketingStrengthBackground = `linear-gradient(135deg, ${brandTokens.palette.secondaryTint} 0%, ${brandTokens.palette.surface} 48%, ${brandTokens.palette.primaryTint} 100%)`;
const projectGithubUrl = 'https://github.com/cheon0965/PERSONAL_ERP.git';
const projectGithubDisplayUrl = 'github.com/cheon0965/PERSONAL_ERP';
const heroDashboardScreenshotSrc = '/marketing-dashboard-screenshot.png';

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
        <SearchIntentSection />
        <StrengthSection />
        <FaqSection />
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
              onClick={() => smoothScrollTo('use-cases')}
            >
              활용 사례
            </Button>
            <Button
              color="inherit"
              size="small"
              onClick={() => smoothScrollTo('strengths')}
            >
              장점
            </Button>
            <Button
              color="inherit"
              size="small"
              onClick={() => smoothScrollTo('faq')}
            >
              FAQ
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
        minHeight: { xs: 'auto', md: 'calc(88svh - 68px)' },
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: marketingBorderColor,
        bgcolor: brandTokens.palette.background
      }}
    >
      <HeroDashboardBackdrop />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          background: {
            xs: `linear-gradient(180deg, ${alpha(
              brandTokens.palette.background,
              0.98
            )} 0%, ${alpha(brandTokens.palette.background, 0.9)} 56%, ${alpha(
              brandTokens.palette.background,
              0.76
            )} 100%)`,
            md: `linear-gradient(90deg, ${brandTokens.palette.background} 0%, ${alpha(
              brandTokens.palette.background,
              0.98
            )} 42%, ${alpha(brandTokens.palette.background, 0.9)} 62%, ${alpha(
              brandTokens.palette.background,
              0.32
            )} 100%)`
          }
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Stack
          spacing={3}
          sx={{
            maxWidth: 700,
            py: { xs: 4.5, md: 9.5 }
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
                color: brandTokens.palette.text,
                wordBreak: 'keep-all'
              }}
            >
              개인사업자와 소상공인의 월별 재무 운영을 한 흐름으로 정리하는
              ERP입니다.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                maxWidth: 600,
                color: marketingReadableMutedText,
                lineHeight: 1.8,
                wordBreak: 'keep-all'
              }}
            >
              은행·카드 업로드, 반복 규칙, 계획 항목, 전표 확정, 월 마감과 차기
              이월을 연결했습니다. 매달 반복되는 장부 정리를 더 짧고 분명하게
              끝내도록 만든 포트폴리오 프로젝트입니다.
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            useFlexGap
            flexWrap="wrap"
          >
            <Button
              component={Link}
              href={demoLoginPath}
              variant="contained"
              size="large"
              startIcon={<LoginRoundedIcon />}
              sx={{ px: 3 }}
            >
              데모로 둘러보기
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
            <Button
              component="a"
              href={projectGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="large"
              startIcon={<GitHubIcon />}
              sx={{
                px: 2.5,
                borderColor: alpha(brandTokens.palette.primary, 0.18),
                bgcolor: alpha(brandTokens.palette.surface, 0.72)
              }}
            >
              GitHub 보기
            </Button>
          </Stack>

          <PublicDemoNotice />

          <Grid container spacing={1.5} sx={{ maxWidth: 620 }}>
            {[
              ['운영 기준', '월 단위 마감'],
              ['회계 흐름', '거래 후보 → 전표'],
              ['입력 방식', '업로드·반복·수기']
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
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.25}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      sx={{
        maxWidth: 620,
        p: { xs: 1.5, sm: 1.75 },
        borderRadius: '8px',
        border: '1px solid',
        borderColor: alpha(brandTokens.palette.primaryBright, 0.16),
        bgcolor: alpha(brandTokens.palette.surface, 0.86),
        boxShadow: '0 14px 34px rgba(6, 34, 111, 0.06)'
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip label="공개 데모" color="success" size="small" />
        <Typography variant="body2" sx={{ color: marketingReadableMutedText }}>
          로그인 화면에 {demoLoginCredentials.email} 계정 정보가 자동으로
          입력됩니다.
        </Typography>
      </Stack>
      <Typography
        component="a"
        href={projectGithubUrl}
        target="_blank"
        rel="noopener noreferrer"
        variant="body2"
        sx={{
          color: brandTokens.palette.primary,
          fontWeight: 800,
          lineHeight: 1.6,
          overflowWrap: 'anywhere',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' }
        }}
      >
        {projectGithubDisplayUrl}
      </Typography>
    </Stack>
  );
}

function HeroDashboardBackdrop() {
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
          right: { xs: -430, sm: -250, md: -300, lg: -190, xl: -96 },
          top: { xs: 156, sm: 108, md: 96 },
          bottom: { xs: -40, md: 0 },
          width: { xs: 820, sm: 980, md: '76vw', lg: '72vw' },
          maxWidth: { md: 1280 },
          opacity: { xs: 0.26, sm: 0.34, md: 0.78 }
        }}
      >
        <Box
          component="img"
          src={heroDashboardScreenshotSrc}
          alt=""
          sx={{
            display: 'block',
            width: '100%',
            height: { xs: 520, md: 'calc(88svh - 96px)' },
            minHeight: { md: 560 },
            objectFit: 'cover',
            objectPosition: 'right center',
            filter: 'saturate(1.02) contrast(1.02)',
            boxShadow: '0 28px 80px rgba(6, 23, 79, 0.18)'
          }}
        />
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
          title="매달 반복되는 장부 운영을 한 흐름으로"
          description="운영 월 시작, 거래 수집, 전표 확정, 마감과 이월을 같은 기준으로 이어줍니다."
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
          title="장부 운영에 필요한 핵심 화면"
          description="대시보드, 기준 데이터, 업로드 배치, 거래 검토, 전표 확정, 월 마감을 한 제품 안에서 확인할 수 있습니다."
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

function SearchIntentSection() {
  return (
    <Box
      id="use-cases"
      component="section"
      sx={{
        py: { xs: 6, md: 8 },
        bgcolor: brandTokens.palette.surface,
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: marketingBorderColor
      }}
    >
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="USE CASES"
          title="작은 사업자가 자주 겪는 업무를 기준으로 정리했습니다"
          description="장부 정리, 명세 업로드, 전표 관리, 월 마감처럼 매달 반복되는 일을 실제 화면 흐름으로 풀었습니다."
        />

        <Grid container spacing={2} sx={{ mt: 3 }}>
          {publicSiteUseCases.map((useCase) => (
            <Grid key={useCase.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Stack
                spacing={1.5}
                sx={{
                  height: '100%',
                  p: appLayout.cardPadding,
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: marketingBorderColor,
                  bgcolor: brandTokens.palette.surfaceSoft
                }}
              >
                <Box
                  component="span"
                  sx={{
                    alignSelf: 'flex-start',
                    maxWidth: '100%',
                    px: 1,
                    py: 0.5,
                    borderRadius: '6px',
                    bgcolor: alpha(brandTokens.palette.primaryBright, 0.1),
                    color: brandTokens.palette.primaryDark,
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    lineHeight: 1.45,
                    wordBreak: 'keep-all'
                  }}
                >
                  {useCase.searchText}
                </Box>
                <Typography variant="h6" fontWeight={900}>
                  {useCase.title}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.7, wordBreak: 'keep-all' }}
                >
                  {useCase.description}
                </Typography>
              </Stack>
            </Grid>
          ))}
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
                  color: brandTokens.palette.primaryDark,
                  wordBreak: 'keep-all'
                }}
              >
                작은 사업자의 실제 월말 흐름에 맞춘 ERP
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: marketingReadableMutedText,
                  lineHeight: 1.8,
                  wordBreak: 'keep-all'
                }}
              >
                화면은 가볍게, 데이터 경계는 단단하게 가져갑니다. 거래를
                입력하는 순간부터 전표, 재무제표, 차기 이월, 다음 달 전망까지
                같은 기준으로 이어집니다.
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

function FaqSection() {
  return (
    <Box
      id="faq"
      component="section"
      sx={{
        py: { xs: 6, md: 8 },
        bgcolor: brandTokens.palette.background,
        borderBottom: '1px solid',
        borderColor: marketingBorderColor
      }}
    >
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="FAQ"
          title="프로젝트 범위와 사용 기준"
          description="무엇을 돕고 어디까지 책임지는지 첫 화면에서 바로 판단할 수 있도록 정리했습니다."
        />

        <Grid container spacing={2} sx={{ mt: 3 }}>
          {publicSiteFaqs.map((faq) => (
            <Grid key={faq.question} size={{ xs: 12, md: 6 }}>
              <Stack
                component="article"
                spacing={1}
                sx={{
                  height: '100%',
                  p: appLayout.cardPadding,
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: marketingBorderColor,
                  bgcolor: brandTokens.palette.surface
                }}
              >
                <Typography
                  component="h3"
                  variant="h6"
                  fontWeight={900}
                  sx={{ wordBreak: 'keep-all' }}
                >
                  {faq.question}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.75, wordBreak: 'keep-all' }}
                >
                  {faq.answer}
                </Typography>
              </Stack>
            </Grid>
          ))}
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
            <Typography
              variant="h4"
              fontWeight={900}
              letterSpacing={0}
              sx={{ wordBreak: 'keep-all' }}
            >
              데모 계정으로 월 운영 흐름을 확인해보세요.
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 620, lineHeight: 1.75, wordBreak: 'keep-all' }}
            >
              로그인 화면에 데모 계정이 자동 입력됩니다. 기준 데이터, 수집 거래,
              전표 확정, 월 마감까지 이어지는 구조를 바로 둘러볼 수 있습니다.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button
              component={Link}
              href={demoLoginPath}
              variant="contained"
              size="large"
              startIcon={<LoginRoundedIcon />}
            >
              데모로 둘러보기
            </Button>
            <Button
              component="a"
              href={projectGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="large"
              startIcon={<GitHubIcon />}
            >
              GitHub 보기
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
          fontSize: { xs: '1.85rem', md: '2.45rem' },
          lineHeight: 1.14,
          letterSpacing: 0,
          wordBreak: 'keep-all'
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ lineHeight: 1.8, wordBreak: 'keep-all' }}
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
