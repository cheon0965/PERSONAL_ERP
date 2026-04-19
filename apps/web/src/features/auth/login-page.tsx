'use client';

import * as React from 'react';
import type { Route } from 'next';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { appLayout } from '@/shared/ui/layout-metrics';
import { AuthCardHeader } from './auth-card-header';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.')
});

type LoginFormInput = z.infer<typeof loginSchema>;

const loginHighlights = [
  {
    title: '기본 보호 모드',
    description:
      '대시보드와 업무 화면은 실제 인증 세션이 있어야만 접근할 수 있습니다.',
    icon: SecurityRoundedIcon
  },
  {
    title: '자동 로그인 보호',
    description:
      '로그인 상태가 만료되면 자동으로 확인하고, 필요하면 다시 로그인 화면으로 안내합니다.',
    icon: LockOpenRoundedIcon
  },
  {
    title: '안전한 시작 흐름',
    description:
      '업무 화면을 열기 전에 현재 계정과 사업장 정보를 먼저 확인합니다.',
    icon: TaskAltRoundedIcon
  }
] as const;

const loginMetrics = [
  { label: '세션 복원', value: '자동' },
  { label: '보호 화면', value: '기본 적용' },
  { label: '운영 기준', value: '월 단위' }
] as const;

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = React.useMemo(
    () => resolveNextPath(searchParams?.get('next') ?? null),
    [searchParams]
  );
  const emailVerified = searchParams?.get('verified') === '1';
  const { login, status } = useAuthSession();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm<LoginFormInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'demo@example.com',
      password: 'Demo1234!'
    }
  });

  React.useEffect(() => {
    if (status === 'authenticated') {
      router.replace(nextPath as Route);
    }
  }, [nextPath, router, status]);

  const isBusy = form.formState.isSubmitting || status === 'loading';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: appLayout.authPagePaddingY,
        background:
          'radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 30%), radial-gradient(circle at top right, rgba(15, 23, 42, 0.12), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #f3f7fc 100%)'
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={appLayout.authGridGap} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 7 }}>
            <Card
              sx={{
                position: 'relative',
                height: '100%',
                overflow: 'hidden',
                background:
                  'linear-gradient(160deg, rgba(15, 23, 42, 0.98), rgba(30, 64, 175, 0.96) 58%, rgba(37, 99, 235, 0.92))',
                color: 'common.white',
                boxShadow: '0 22px 48px rgba(15, 23, 42, 0.16)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                  maskImage:
                    'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.08))',
                  pointerEvents: 'none'
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  right: -80,
                  bottom: -120,
                  width: 360,
                  height: 360,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)',
                  pointerEvents: 'none'
                }
              }}
            >
              <CardContent
                sx={{ p: appLayout.authSurfacePadding, height: '100%' }}
              >
                <Stack
                  spacing={appLayout.authSurfaceGap}
                  justifyContent="space-between"
                  height="100%"
                >
                  <Stack
                    spacing={appLayout.authSurfaceGap}
                    sx={{ position: 'relative', zIndex: 1 }}
                  >
                    <Chip
                      label="사업장 로그인"
                      sx={{
                        alignSelf: 'flex-start',
                        color: 'common.white',
                        fontWeight: 700,
                        backgroundColor: alpha('#ffffff', 0.12),
                        border: `1px solid ${alpha('#ffffff', 0.12)}`
                      }}
                    />

                    <Stack spacing={appLayout.fieldGap}>
                      <Typography
                        variant="h2"
                        sx={{
                          maxWidth: 620,
                          fontWeight: 800,
                          letterSpacing: '-0.04em',
                          fontSize: { xs: '2.5rem', md: '4.1rem' },
                          lineHeight: 1.06
                        }}
                      >
                        PERSONAL ERP는
                        <br />
                        사업 운영 화면으로
                        <br />
                        바로 진입합니다.
                      </Typography>

                      <Typography
                        variant="body1"
                        sx={{
                          maxWidth: 620,
                          color: alpha('#ffffff', 0.76),
                          fontSize: { xs: '1rem', md: '1.05rem' },
                          lineHeight: 1.75
                        }}
                      >
                        로그인 이후에는 현재 사용자를 복원하고, 보호된 서비스
                        호출과 대시보드 화면을 실제 사업장 이용 정보에
                        연결합니다. 장식보다는 월 운영, 거래 검토, 마감 흐름이
                        먼저 읽히는 1인 사업자·소상공인용 ERP 경험을 목표로
                        구성했습니다.
                      </Typography>
                    </Stack>

                    <Grid container spacing={appLayout.authMetricGap}>
                      {loginMetrics.map((item) => (
                        <Grid key={item.label} size={{ xs: 12, sm: 4 }}>
                          <Box
                            sx={{
                              p: 1.75,
                              borderRadius: 4,
                              backgroundColor: alpha('#ffffff', 0.08),
                              border: `1px solid ${alpha('#ffffff', 0.14)}`
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ color: alpha('#ffffff', 0.68) }}
                            >
                              {item.label}
                            </Typography>
                            <Typography
                              variant="h6"
                              sx={{ mt: 0.75, fontWeight: 800 }}
                            >
                              {item.value}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Stack>

                  <Grid
                    container
                    spacing={appLayout.authFeatureGap}
                    sx={{ position: 'relative', zIndex: 1 }}
                  >
                    {loginHighlights.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Grid key={item.title} size={{ xs: 12, md: 4 }}>
                          <Box
                            sx={{
                              height: '100%',
                              p: 2.25,
                              borderRadius: 4,
                              backgroundColor: alpha('#ffffff', 0.08),
                              border: `1px solid ${alpha('#ffffff', 0.14)}`
                            }}
                          >
                            <Stack spacing={1.4}>
                              <Box
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 42,
                                  height: 42,
                                  borderRadius: 3,
                                  backgroundColor: alpha('#ffffff', 0.12)
                                }}
                              >
                                <Icon fontSize="small" />
                              </Box>
                              <Box>
                                <Typography fontWeight={700}>
                                  {item.title}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    mt: 0.75,
                                    color: alpha('#ffffff', 0.72),
                                    lineHeight: 1.7
                                  }}
                                >
                                  {item.description}
                                </Typography>
                              </Box>
                            </Stack>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Card
              sx={{
                position: 'relative',
                height: '100%',
                overflow: 'hidden',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '0 0 auto 0',
                  height: 5,
                  background:
                    'linear-gradient(90deg, rgba(37,99,235,1) 0%, rgba(96,165,250,0.85) 100%)'
                }
              }}
            >
              <CardContent sx={{ p: appLayout.authSurfacePadding }}>
                <Stack spacing={appLayout.authSurfaceGap}>
                  <AuthCardHeader
                    eyebrow="인증"
                    title="사업장에 로그인"
                    description="로그인 상태는 안전하게 보관되며, 만료되면 자동으로 확인한 뒤 필요한 경우 다시 로그인하도록 안내합니다."
                    aside={
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 44,
                          height: 44,
                          borderRadius: 3.5,
                          backgroundColor: alpha('#2563eb', 0.08),
                          color: 'primary.main'
                        }}
                      >
                        <TimelineRoundedIcon fontSize="small" />
                      </Box>
                    }
                  />

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label="데모 이메일: demo@example.com" />
                    <Chip label="데모 비밀번호: Demo1234!" />
                  </Stack>

                  {submitError ? (
                    <Alert severity="error" variant="outlined">
                      {submitError}
                    </Alert>
                  ) : null}

                  {emailVerified ? (
                    <Alert severity="success" variant="outlined">
                      이메일 인증이 완료되었습니다. 가입한 이메일과 비밀번호로
                      로그인해 주세요.
                    </Alert>
                  ) : null}

                  <form
                    onSubmit={form.handleSubmit(async (values) => {
                      setSubmitError(null);

                      try {
                        await login(values);
                        router.replace(nextPath as Route);
                      } catch (error) {
                        setSubmitError(
                          error instanceof Error
                            ? error.message
                            : '로그인에 실패했습니다.'
                        );
                      }
                    })}
                  >
                    <Stack spacing={appLayout.fieldGap}>
                      <TextField
                        label="이메일"
                        type="email"
                        autoComplete="email"
                        error={Boolean(form.formState.errors.email)}
                        helperText={form.formState.errors.email?.message}
                        {...form.register('email')}
                      />
                      <TextField
                        label="비밀번호"
                        type="password"
                        autoComplete="current-password"
                        error={Boolean(form.formState.errors.password)}
                        helperText={form.formState.errors.password?.message}
                        {...form.register('password')}
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={isBusy}
                      >
                        {isBusy ? '세션 확인 중...' : '로그인'}
                      </Button>
                      <Button
                        type="button"
                        variant="outlined"
                        size="large"
                        onClick={() => router.push('/register' as Route)}
                      >
                        새 계정 만들기
                      </Button>
                    </Stack>
                  </form>

                  <Box
                    sx={{
                      p: 2.25,
                      borderRadius: 4,
                      backgroundColor: alpha('#2563eb', 0.05),
                      border: `1px solid ${alpha('#2563eb', 0.12)}`
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      로그인 후 동작
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, lineHeight: 1.75 }}
                    >
                      로그인하면 현재 계정과 연결된 사업장을 확인한 뒤 대시보드로
                      이동합니다. 권한이 만료되었거나 확인이 필요한 경우에는
                      안전하게 이 화면으로 돌아옵니다.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function resolveNextPath(candidate: string | null): string {
  if (!candidate || !candidate.startsWith('/')) {
    return '/dashboard';
  }

  return candidate;
}
