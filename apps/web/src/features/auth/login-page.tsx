'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { readErrorUserMessage } from '@/shared/api/fetch-json';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { BrandLogo } from '@/shared/brand/brand-logo';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.')
});

type LoginFormInput = z.infer<typeof loginSchema>;

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
        display: 'flex',
        alignItems: 'center',
        py: appLayout.authPagePaddingY,
        backgroundColor: brandTokens.palette.background
      }}
    >
      <Container maxWidth="md">
        <Card
          sx={{
            overflow: 'hidden',
            borderRadius: 2,
            border: `1px solid ${alpha(brandTokens.palette.primary, 0.1)}`,
            boxShadow: brandTokens.shadow.cardStrong
          }}
        >
          <Grid container alignItems="stretch">
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  minHeight: { xs: 220, md: 500 },
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  p: appLayout.authSurfacePadding,
                  color: 'common.white',
                  background: brandTokens.gradient.brand
                }}
              >
                <Stack spacing={2.5}>
                  <Link
                    href={'/' as Route}
                    style={{ display: 'inline-flex', alignSelf: 'flex-start', lineHeight: 0 }}
                  >
                    <BrandLogo
                      priority
                      sx={{
                        width: { xs: 182, md: 204 },
                        opacity: 0.94,
                        '& img': {
                          filter:
                            'brightness(0) invert(1) drop-shadow(0 10px 18px rgba(3, 21, 74, 0.2))'
                        }
                      }}
                    />
                  </Link>

                  <Stack spacing={1.25}>
                    <Typography
                      variant="h3"
                      sx={{
                        maxWidth: 320,
                        fontWeight: 800,
                        fontSize: { xs: '2rem', md: '2.45rem' },
                        lineHeight: 1.14,
                        letterSpacing: 0
                      }}
                    >
                      운영 포털
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        maxWidth: 320,
                        color: alpha('#ffffff', 0.78),
                        lineHeight: 1.7
                      }}
                    >
                      계정 정보를 입력해 업무 화면으로 이동하세요.
                    </Typography>
                  </Stack>
                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    mt: 4,
                    color: alpha('#ffffff', 0.68),
                    lineHeight: 1.6
                  }}
                >
                  인증된 사용자만 접근할 수 있습니다.
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <CardContent
                sx={{
                  height: '100%',
                  p: appLayout.authSurfacePadding
                }}
              >
                <Stack
                  spacing={appLayout.authSurfaceGap}
                  justifyContent="center"
                  height="100%"
                >
                  <Stack spacing={1}>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ fontWeight: 700, letterSpacing: 0 }}
                    >
                      AUTHENTICATION
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 800,
                        fontSize: { xs: '1.65rem', md: '2rem' },
                        lineHeight: 1.2,
                        letterSpacing: 0
                      }}
                    >
                      로그인
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.7 }}
                    >
                      등록된 이메일과 비밀번호를 입력하세요.
                    </Typography>
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
                          readErrorUserMessage(error, '로그인에 실패했습니다.')
                        );
                      }
                    })}
                  >
                    <Stack spacing={appLayout.fieldGap}>
                      <TextField
                        fullWidth
                        label="이메일"
                        type="email"
                        autoComplete="email"
                        error={Boolean(form.formState.errors.email)}
                        helperText={form.formState.errors.email?.message}
                        {...form.register('email')}
                      />
                      <TextField
                        fullWidth
                        label="비밀번호"
                        type="password"
                        autoComplete="current-password"
                        error={Boolean(form.formState.errors.password)}
                        helperText={form.formState.errors.password?.message}
                        {...form.register('password')}
                      />
                      <Box sx={{ textAlign: 'right', mt: -0.5 }}>
                        <Typography
                          component={Link}
                          href={'/forgot-password' as Route}
                          variant="body2"
                          color="primary"
                          sx={{
                            textDecoration: 'none',
                            fontWeight: 600,
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          비밀번호를 잊으셨나요?
                        </Typography>
                      </Box>
                      <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        size="large"
                        startIcon={<LoginRoundedIcon />}
                        disabled={isBusy}
                        sx={{ py: 1.2 }}
                      >
                        {isBusy ? '확인 중...' : '로그인'}
                      </Button>
                      <Button
                        fullWidth
                        type="button"
                        variant="outlined"
                        size="large"
                        startIcon={<PersonAddAltRoundedIcon />}
                        onClick={() => router.push('/register' as Route)}
                        sx={{ py: 1.2 }}
                      >
                        새 계정 만들기
                      </Button>
                    </Stack>
                  </form>
                </Stack>
              </CardContent>
            </Grid>
          </Grid>
        </Card>
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
