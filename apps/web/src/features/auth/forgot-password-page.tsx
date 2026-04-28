'use client';

import * as React from 'react';
import type { Route } from 'next';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { requestPasswordReset } from '@/features/auth/auth.api';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';
import { AuthCardHeader } from './auth-card-header';

const forgotPasswordSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.')
});

type ForgotPasswordFormInput = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [sentEmail, setSentEmail] = React.useState<string | null>(null);

  const form = useForm<ForgotPasswordFormInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' }
  });

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
                eyebrow="비밀번호 찾기"
                title="비밀번호 재설정"
                description="가입 시 사용한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다."
                aside={
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 3.5,
                      backgroundColor: alpha(
                        brandTokens.palette.secondary,
                        0.12
                      ),
                      color: 'primary.main'
                    }}
                  >
                    <LockResetRoundedIcon fontSize="small" />
                  </Box>
                }
              />

              {sentEmail ? (
                <Alert
                  severity="success"
                  icon={<MarkEmailReadRoundedIcon />}
                  variant="outlined"
                >
                  <strong>{sentEmail}</strong> 주소로 비밀번호 재설정 링크를
                  보냈습니다. 메일함을 확인해 주세요.
                </Alert>
              ) : null}

              {submitError ? (
                <Alert severity="error" variant="outlined">
                  {submitError}
                </Alert>
              ) : null}

              {!sentEmail ? (
                <form
                  onSubmit={form.handleSubmit(async (values) => {
                    setSubmitError(null);
                    setSentEmail(null);

                    try {
                      await requestPasswordReset({
                        email: values.email.trim()
                      });
                      setSentEmail(values.email.trim());
                    } catch (error) {
                      setSubmitError(
                        error instanceof Error
                          ? error.message
                          : '비밀번호 재설정 메일 요청에 실패했습니다.'
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
                      placeholder="owner@example.com"
                      error={Boolean(form.formState.errors.email)}
                      helperText={form.formState.errors.email?.message}
                      {...form.register('email')}
                    />
                    <Button
                      fullWidth
                      type="submit"
                      variant="contained"
                      size="large"
                      startIcon={<LockResetRoundedIcon />}
                      disabled={form.formState.isSubmitting}
                      sx={{ py: 1.2 }}
                    >
                      {form.formState.isSubmitting
                        ? '메일 발송 중...'
                        : '재설정 링크 받기'}
                    </Button>
                    <Button
                      fullWidth
                      type="button"
                      variant="outlined"
                      size="large"
                      startIcon={<ArrowBackRoundedIcon />}
                      onClick={() => router.push('/login' as Route)}
                      sx={{ py: 1.2 }}
                    >
                      로그인으로 돌아가기
                    </Button>
                  </Stack>
                </form>
              ) : (
                <Stack spacing={1.5}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.7 }}
                  >
                    메일이 도착하지 않으면 스팸함을 확인하거나 다시 시도해
                    주세요.
                  </Typography>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    startIcon={<ArrowBackRoundedIcon />}
                    onClick={() => router.push('/login' as Route)}
                    sx={{ py: 1.2 }}
                  >
                    로그인으로 돌아가기
                  </Button>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
