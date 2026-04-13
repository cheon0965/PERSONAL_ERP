'use client';

import * as React from 'react';
import type { Route } from 'next';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { registerWithPassword } from '@/features/auth/auth.api';
import { appLayout } from '@/shared/ui/layout-metrics';

const registerSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해 주세요.').max(80),
    email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    passwordConfirm: z.string().min(8, '비밀번호 확인을 입력해 주세요.')
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 서로 다릅니다.'
  });

type RegisterFormInput = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [sentEmail, setSentEmail] = React.useState<string | null>(null);

  const form = useForm<RegisterFormInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      passwordConfirm: ''
    }
  });

  const isBusy = form.formState.isSubmitting;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: appLayout.authPagePaddingY,
        background:
          'radial-gradient(circle at top left, rgba(14, 165, 233, 0.2), transparent 34%), radial-gradient(circle at bottom right, rgba(20, 83, 45, 0.18), transparent 30%), linear-gradient(180deg, #f7fbf8 0%, #eef6f1 100%)'
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            overflow: 'hidden',
            boxShadow: '0 22px 48px rgba(15, 23, 42, 0.14)',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
            '&::before': {
              content: '""',
              display: 'block',
              height: 5,
              background:
                'linear-gradient(90deg, rgba(14,165,233,1), rgba(34,197,94,0.9))'
            }
          }}
        >
          <CardContent sx={{ p: appLayout.authSurfacePadding }}>
            <Stack spacing={appLayout.authSurfaceGap}>
              <Stack spacing={1.5}>
                <Chip
                  icon={<PersonAddAltRoundedIcon />}
                  label="새 워크스페이스 시작"
                  sx={{
                    alignSelf: 'flex-start',
                    fontWeight: 700,
                    backgroundColor: alpha('#0ea5e9', 0.08)
                  }}
                />
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  회원가입
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>
                  이메일 인증을 완료하면 기본 사업 장부와 OWNER 워크스페이스가
                  준비됩니다. 인증 메일은 Gmail API 발송 경계로 연결됩니다.
                </Typography>
              </Stack>

              {sentEmail ? (
                <Alert
                  severity="success"
                  icon={<MarkEmailReadRoundedIcon />}
                  variant="outlined"
                >
                  {sentEmail} 주소로 인증 메일을 보냈습니다. 메일함에서 인증
                  링크를 열어 주세요.
                </Alert>
              ) : null}

              {submitError ? (
                <Alert severity="error" variant="outlined">
                  {submitError}
                </Alert>
              ) : null}

              <form
                onSubmit={form.handleSubmit(async (values) => {
                  setSubmitError(null);
                  setSentEmail(null);

                  try {
                    await registerWithPassword({
                      name: values.name.trim(),
                      email: values.email.trim(),
                      password: values.password
                    });
                    setSentEmail(values.email.trim());
                    form.reset({
                      name: values.name,
                      email: values.email,
                      password: '',
                      passwordConfirm: ''
                    });
                  } catch (error) {
                    setSubmitError(
                      error instanceof Error
                        ? error.message
                        : '회원가입 요청에 실패했습니다.'
                    );
                  }
                })}
              >
                <Stack spacing={appLayout.fieldGap}>
                  <TextField
                    label="이름"
                    autoComplete="name"
                    error={Boolean(form.formState.errors.name)}
                    helperText={form.formState.errors.name?.message}
                    {...form.register('name')}
                  />
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
                    autoComplete="new-password"
                    error={Boolean(form.formState.errors.password)}
                    helperText={form.formState.errors.password?.message}
                    {...form.register('password')}
                  />
                  <TextField
                    label="비밀번호 확인"
                    type="password"
                    autoComplete="new-password"
                    error={Boolean(form.formState.errors.passwordConfirm)}
                    helperText={form.formState.errors.passwordConfirm?.message}
                    {...form.register('passwordConfirm')}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isBusy}
                  >
                    {isBusy ? '인증 메일 발송 중...' : '인증 메일 받기'}
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    startIcon={<ArrowBackRoundedIcon />}
                    onClick={() => router.push('/login' as Route)}
                  >
                    로그인으로 돌아가기
                  </Button>
                </Stack>
              </form>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
