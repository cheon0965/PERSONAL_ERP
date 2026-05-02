'use client';

import * as React from 'react';
import type { Route } from 'next';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import MarkEmailUnreadRoundedIcon from '@mui/icons-material/MarkEmailUnreadRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { resendVerificationEmail, verifyEmail } from '@/features/auth/auth.api';
import { readErrorUserMessage } from '@/shared/api/fetch-json';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';
import { AuthCardHeader } from './auth-card-header';

const resendSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.')
});

type ResendFormInput = z.infer<typeof resendSchema>;

export function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token')?.trim() ?? '';
  const didVerifyRef = React.useRef(false);
  const [status, setStatus] = React.useState<'loading' | 'verified' | 'failed'>(
    'loading'
  );
  const [message, setMessage] = React.useState<string | null>(null);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);

  const form = useForm<ResendFormInput>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: '' }
  });

  React.useEffect(() => {
    if (didVerifyRef.current) {
      return;
    }

    didVerifyRef.current = true;

    if (!token) {
      setStatus('failed');
      setMessage('이메일 인증 정보를 찾지 못했습니다.');
      return;
    }

    void verifyEmail({ token })
      .then(() => {
        setStatus('verified');
        setMessage('이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.');
      })
      .catch((error) => {
        setStatus('failed');
        setMessage(readErrorUserMessage(error, '이메일 인증에 실패했습니다.'));
      });
  }, [token]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: appLayout.authPagePaddingY,
        backgroundColor: brandTokens.palette.background
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            overflow: 'hidden',
            boxShadow: brandTokens.shadow.cardStrong,
            background: `linear-gradient(180deg, ${alpha(brandTokens.palette.surface, 0.98)}, ${alpha(brandTokens.palette.surfaceSoft, 0.98)})`,
            '&::before': {
              content: '""',
              display: 'block',
              height: 5,
              background: `linear-gradient(90deg, ${brandTokens.palette.secondary}, ${brandTokens.palette.primary})`
            }
          }}
        >
          <CardContent sx={{ p: appLayout.authSurfacePadding }}>
            <Stack spacing={appLayout.authSurfaceGap} alignItems="stretch">
              <AuthCardHeader
                eyebrow="계정 확인"
                title="이메일 인증"
                description="인증이 완료되면 회원가입 시 만든 계정으로 바로 로그인할 수 있습니다."
                aside={
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 3.5,
                      backgroundColor:
                        status === 'failed'
                          ? alpha(brandTokens.palette.error, 0.08)
                          : alpha(brandTokens.palette.secondary, 0.12),
                      color: status === 'failed' ? 'error.main' : 'success.main'
                    }}
                  >
                    {status === 'loading' ? (
                      <CircularProgress size={24} />
                    ) : status === 'verified' ? (
                      <CheckCircleRoundedIcon fontSize="small" />
                    ) : (
                      <ErrorOutlineRoundedIcon fontSize="small" />
                    )}
                  </Box>
                }
              />

              {message ? (
                <Alert
                  severity={status === 'verified' ? 'success' : 'error'}
                  variant="outlined"
                >
                  {message}
                </Alert>
              ) : null}

              {status === 'verified' ? (
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => router.push('/login?verified=1' as Route)}
                >
                  로그인하러 가기
                </Button>
              ) : null}

              {status === 'failed' ? (
                <Box
                  sx={{
                    p: 2.25,
                    borderRadius: 4,
                    backgroundColor: alpha(brandTokens.palette.secondary, 0.08),
                    border: `1px solid ${alpha(brandTokens.palette.secondaryDark, 0.18)}`
                  }}
                >
                  <form
                    onSubmit={form.handleSubmit(async (values) => {
                      setResendMessage(null);

                      try {
                        await resendVerificationEmail({
                          email: values.email.trim()
                        });
                        setResendMessage(
                          '입력한 이메일로 새 인증 메일을 보냈습니다.'
                        );
                      } catch (error) {
                        setResendMessage(
                          readErrorUserMessage(
                            error,
                            '인증 메일 재발송에 실패했습니다.'
                          )
                        );
                      }
                    })}
                  >
                    <Stack spacing={appLayout.fieldGap}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        인증 메일 다시 받기
                      </Typography>
                      {resendMessage ? (
                        <Alert
                          severity={
                            resendMessage.includes('보냈습니다')
                              ? 'success'
                              : 'error'
                          }
                          variant="outlined"
                        >
                          {resendMessage}
                        </Alert>
                      ) : null}
                      <TextField
                        label="이메일"
                        type="email"
                        autoComplete="email"
                        error={Boolean(form.formState.errors.email)}
                        helperText={form.formState.errors.email?.message}
                        {...form.register('email')}
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        startIcon={<MarkEmailUnreadRoundedIcon />}
                        disabled={form.formState.isSubmitting}
                      >
                        {form.formState.isSubmitting
                          ? '재발송 중...'
                          : '인증 메일 재발송'}
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        onClick={() => router.push('/login' as Route)}
                      >
                        로그인으로 돌아가기
                      </Button>
                    </Stack>
                  </form>
                </Box>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
