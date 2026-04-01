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
import { accessTokenStoragePolicy } from '@/shared/auth/auth-session-store';
import { appLayout } from '@/shared/ui/layout-metrics';

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
    title: '토큰 연동 API 클라이언트',
    description:
      '보호 요청은 Bearer 토큰을 자동으로 붙이고, 만료 시 복구 흐름에 연결됩니다.',
    icon: LockOpenRoundedIcon
  },
  {
    title: '예측 가능한 부팅 흐름',
    description:
      '보호 페이지가 렌더링되기 전에 /auth/refresh로 현재 세션을 먼저 복원합니다.',
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
                      label="워크스페이스 로그인"
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
                        Personal ERP는
                        <br />
                        실무형 재무 운영 화면으로
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
                        로그인 이후에는 현재 사용자를 복원하고, 보호된 API
                        호출과 대시보드 화면을 실제 워크스페이스 세션에
                        연결합니다. 장식보다는 운영 흐름이 먼저 읽히는 ERP
                        경험을 목표로 구성했습니다.
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
                  <Stack spacing={appLayout.authMetricGap}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box>
                        <Typography variant="overline" color="text.secondary">
                          인증
                        </Typography>
                        <Typography
                          variant="h4"
                          sx={{ mt: 0.5, fontWeight: 800 }}
                        >
                          워크스페이스에 로그인
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: { xs: 'none', sm: 'inline-flex' },
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 48,
                          height: 48,
                          borderRadius: 4,
                          backgroundColor: alpha('#2563eb', 0.08),
                          color: 'primary.main'
                        }}
                      >
                        <TimelineRoundedIcon />
                      </Box>
                    </Stack>

                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{ lineHeight: 1.8 }}
                    >
                      액세스 토큰은 `{accessTokenStoragePolicy}` 로 보관하고,
                      HttpOnly 리프레시 쿠키를 통해 `POST /auth/refresh`로
                      세션을 복원합니다.
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label="데모 이메일: demo@example.com" />
                    <Chip label="데모 비밀번호: Demo1234!" />
                  </Stack>

                  {submitError ? (
                    <Alert severity="error" variant="outlined">
                      {submitError}
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
                      보호 요청은 `Authorization: Bearer &lt;token&gt;` 헤더를
                      사용합니다. API가 `401`을 반환하면, 클라이언트는 먼저
                      `POST /auth/refresh`를 시도한 뒤 세션을 비우고 이 화면으로
                      돌아옵니다.
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
