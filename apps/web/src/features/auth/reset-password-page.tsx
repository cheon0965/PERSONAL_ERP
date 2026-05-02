'use client';

import * as React from 'react';
import type { Route } from 'next';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
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
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { resetPassword } from '@/features/auth/auth.api';
import { readErrorUserMessage } from '@/shared/api/fetch-json';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';
import { AuthCardHeader } from './auth-card-header';

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다.')
      .max(128, '비밀번호는 128자 이하로 입력해 주세요.'),
    confirmPassword: z.string().min(8, '비밀번호 확인을 입력해 주세요.')
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: '비밀번호가 서로 다릅니다.'
  });

type ResetPasswordFormInput = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token')?.trim() ?? '';
  const [status, setStatus] = React.useState<'form' | 'success' | 'error'>(
    token ? 'form' : 'error'
  );
  const [submitError, setSubmitError] = React.useState<string | null>(
    token ? null : '비밀번호 재설정 링크가 올바르지 않습니다.'
  );

  const form = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' }
  });

  const statusIcon = () => {
    if (status === 'success') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 3.5,
            backgroundColor: alpha(brandTokens.palette.secondary, 0.12),
            color: 'success.main'
          }}
        >
          <CheckCircleRoundedIcon fontSize="small" />
        </Box>
      );
    }
    if (status === 'error') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 3.5,
            backgroundColor: alpha(brandTokens.palette.error, 0.08),
            color: 'error.main'
          }}
        >
          <ErrorOutlineRoundedIcon fontSize="small" />
        </Box>
      );
    }
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 3.5,
          backgroundColor: alpha(brandTokens.palette.secondary, 0.12),
          color: 'primary.main'
        }}
      >
        <LockResetRoundedIcon fontSize="small" />
      </Box>
    );
  };

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
                eyebrow="계정 보안"
                title="새 비밀번호 설정"
                description={
                  status === 'success'
                    ? '비밀번호가 성공적으로 변경되었습니다.'
                    : '새로 사용할 비밀번호를 입력해 주세요.'
                }
                aside={statusIcon()}
              />

              {submitError ? (
                <Alert severity="error" variant="outlined">
                  {submitError}
                </Alert>
              ) : null}

              {status === 'success' ? (
                <Stack spacing={1.5}>
                  <Alert severity="success" variant="outlined">
                    비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.
                  </Alert>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={() => router.push('/login' as Route)}
                    sx={{ py: 1.2 }}
                  >
                    로그인하러 가기
                  </Button>
                </Stack>
              ) : null}

              {status === 'form' ? (
                <form
                  onSubmit={form.handleSubmit(async (values) => {
                    setSubmitError(null);

                    try {
                      await resetPassword({
                        token,
                        newPassword: values.newPassword
                      });
                      setStatus('success');
                    } catch (error) {
                      setSubmitError(
                        readErrorUserMessage(
                          error,
                          '비밀번호 재설정에 실패했습니다.'
                        )
                      );
                      setStatus('error');
                    }
                  })}
                >
                  <Stack spacing={appLayout.fieldGap}>
                    <TextField
                      fullWidth
                      label="새 비밀번호"
                      type="password"
                      autoComplete="new-password"
                      error={Boolean(form.formState.errors.newPassword)}
                      helperText={
                        form.formState.errors.newPassword?.message ??
                        '8자 이상으로 설정해 주세요.'
                      }
                      {...form.register('newPassword')}
                    />
                    <TextField
                      fullWidth
                      label="새 비밀번호 확인"
                      type="password"
                      autoComplete="new-password"
                      error={Boolean(form.formState.errors.confirmPassword)}
                      helperText={
                        form.formState.errors.confirmPassword?.message
                      }
                      {...form.register('confirmPassword')}
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
                        ? '변경 중...'
                        : '비밀번호 변경하기'}
                    </Button>
                    <Button
                      fullWidth
                      type="button"
                      variant="text"
                      onClick={() => router.push('/login' as Route)}
                    >
                      로그인으로 돌아가기
                    </Button>
                  </Stack>
                </form>
              ) : null}

              {status === 'error' && !token ? (
                <Stack spacing={1.5}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.7 }}
                  >
                    비밀번호 재설정 링크가 올바르지 않거나 만료되었습니다. 다시
                    요청해 주세요.
                  </Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={() => router.push('/forgot-password' as Route)}
                    sx={{ py: 1.2 }}
                  >
                    비밀번호 찾기로 이동
                  </Button>
                  <Button
                    fullWidth
                    variant="text"
                    onClick={() => router.push('/login' as Route)}
                  >
                    로그인으로 돌아가기
                  </Button>
                </Stack>
              ) : null}

              {status === 'error' && token ? (
                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={() => router.push('/forgot-password' as Route)}
                    sx={{ py: 1.2 }}
                  >
                    비밀번호 찾기로 이동
                  </Button>
                  <Button
                    fullWidth
                    variant="text"
                    onClick={() => router.push('/login' as Route)}
                  >
                    로그인으로 돌아가기
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
