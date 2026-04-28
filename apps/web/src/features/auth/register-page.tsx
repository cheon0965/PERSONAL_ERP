'use client';

import * as React from 'react';
import type { Route } from 'next';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  Link as MuiLink,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { registerWithPassword } from '@/features/auth/auth.api';
import { BrandLogo } from '@/shared/brand/brand-logo';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';

const requiredAgreementMessage =
  '회원가입을 계속하려면 필수 동의가 필요합니다.';

const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, '닉네임 또는 표시 이름을 입력해 주세요.')
      .max(80, '닉네임은 80자 이하로 입력해 주세요.'),
    email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
    password: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다.')
      .max(128, '비밀번호는 128자 이하로 입력해 주세요.'),
    passwordConfirm: z.string().min(8, '비밀번호 확인을 입력해 주세요.'),
    termsAccepted: z.boolean().refine(Boolean, {
      message: requiredAgreementMessage
    }),
    privacyConsentAccepted: z.boolean().refine(Boolean, {
      message: requiredAgreementMessage
    })
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 서로 다릅니다.'
  });

type RegisterFormInput = z.infer<typeof registerSchema>;

const stableTextFieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: brandTokens.palette.surface
  },
  '& .MuiInputBase-input': {
    bgcolor: 'transparent'
  }
};

const benefitItems = [
  '가입 후 이메일 인증을 완료하면 기본 워크스페이스와 장부가 준비됩니다.',
  '수집 거래, 전표, 월 운영, 기준 데이터를 같은 흐름으로 관리합니다.',
  '입력한 닉네임은 워크스페이스 소유자 표시 이름으로 사용됩니다.'
];

const termsSections = [
  {
    title: '서비스 목적과 범위',
    body: 'PERSONAL ERP는 소규모 사업자와 개인 운영자가 월 운영, 수집 거래, 업로드 행, 전표, 기준 데이터, 반복 규칙, 차량·보험 등 운영 보조 정보를 정리하도록 돕는 업무 관리 도구입니다. 서비스는 사용자의 장부 정리와 내부 운영 판단을 보조하며, 세무·회계·법률·투자 자문을 대체하지 않습니다.'
  },
  {
    title: '회원 계정과 보안',
    body: '회원은 본인이 관리하는 이메일과 안전한 비밀번호를 사용해야 하며, 계정 접근 권한과 인증 정보를 제3자에게 공유하지 않아야 합니다. 닉네임과 이메일은 워크스페이스 식별, 로그인, 이메일 인증, 운영 알림, 보안 기록에 사용됩니다.'
  },
  {
    title: '업무 데이터와 입력 책임',
    body: '거래 내역, 전표, 업로드 자료, 자금수단, 카테고리, 차량·보험 기록 등 회원이 입력하거나 업로드한 업무 데이터의 정확성, 적법한 보유 권한, 제3자 정보 최소화 책임은 회원에게 있습니다. 주민등록번호, 계정 비밀번호, 인증서, 카드 전체번호처럼 서비스 운영에 필요하지 않은 민감 정보는 입력하거나 업로드하지 않아야 합니다.'
  },
  {
    title: '자료 활용과 제한',
    body: '서비스는 회원이 입력한 데이터를 화면 표시, 저장, 검증, 보안 점검, 장애 대응, 기능 개선 범위에서 처리합니다. 회원은 불법 자료 저장, 타인의 권리 침해, 서비스 장애 유발, 보안 우회, 허위 가입, 비정상 자동화 요청에 서비스를 사용할 수 없습니다.'
  },
  {
    title: '서비스 변경과 데이터 관리',
    body: '프로젝트의 기능, 화면, 데이터 구조는 개선 과정에서 변경될 수 있습니다. 회원은 중요한 신고, 결산, 외부 제출 전 원천 자료와 전표 결과를 직접 확인해야 하며, 필요한 경우 별도 백업 또는 내보내기를 준비해야 합니다.'
  }
];

const privacyRows = [
  {
    label: '수집 항목',
    value:
      '이메일, 닉네임/표시 이름, 비밀번호 해시, 이메일 인증 토큰, 접속·요청 보안 기록'
  },
  {
    label: '이용 목적',
    value:
      '회원가입, 이메일 인증, 로그인, 기본 워크스페이스 생성, 계정 보안, 부정 이용 방지'
  },
  {
    label: '업무 데이터',
    value:
      '회원이 입력한 거래·전표·업로드·기준 데이터는 서비스 기능 제공과 장애 대응 범위에서 처리'
  },
  {
    label: '보유 기간',
    value:
      '계정 유지 기간 동안 보관하고, 탈퇴·서비스 종료 시 파기합니다. 법령상 보존, 분쟁 대응, 보안 로그 보관이 필요한 경우 필요한 범위에서 예외적으로 보관할 수 있습니다.'
  },
  {
    label: '동의 거부권',
    value:
      '필수 개인정보 수집·이용에 동의하지 않으면 계정 생성과 서비스 이용을 시작할 수 없습니다.'
  }
];

export function RegisterPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [sentEmail, setSentEmail] = React.useState<string | null>(null);

  const form = useForm<RegisterFormInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      passwordConfirm: '',
      termsAccepted: false,
      privacyConsentAccepted: false
    }
  });

  const isBusy = form.formState.isSubmitting;

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
      <Container maxWidth="lg">
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
              <RegisterIntroPanel />
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <CardContent sx={{ p: appLayout.authSurfacePadding }}>
                <Stack spacing={2.75}>
                  <Stack spacing={1}>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ fontWeight: 800, letterSpacing: 0 }}
                    >
                      ACCOUNT SETUP
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 900,
                        fontSize: { xs: '1.65rem', md: '2rem' },
                        lineHeight: 1.2,
                        letterSpacing: 0
                      }}
                    >
                      새 워크스페이스 만들기
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.7 }}
                    >
                      이메일 인증을 완료하면 기본 장부가 생성됩니다. 먼저 계정
                      표시 이름과 필수 약관 동의를 확인해 주세요.
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
                          name: values.displayName.trim(),
                          email: values.email.trim(),
                          password: values.password,
                          termsAccepted: values.termsAccepted,
                          privacyConsentAccepted: values.privacyConsentAccepted
                        });
                        setSentEmail(values.email.trim());
                        form.reset({
                          displayName: values.displayName,
                          email: values.email,
                          password: '',
                          passwordConfirm: '',
                          termsAccepted: values.termsAccepted,
                          privacyConsentAccepted: values.privacyConsentAccepted
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
                    <Stack spacing={2.25}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="닉네임 / 표시 이름"
                            autoComplete="name"
                            placeholder="예: 홍길동"
                            error={Boolean(form.formState.errors.displayName)}
                            helperText={
                              form.formState.errors.displayName?.message ??
                              '워크스페이스 소유자 이름으로 표시됩니다.'
                            }
                            sx={stableTextFieldSx}
                            {...form.register('displayName')}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="이메일"
                            type="email"
                            autoComplete="email"
                            placeholder="owner@example.com"
                            error={Boolean(form.formState.errors.email)}
                            helperText={form.formState.errors.email?.message}
                            sx={stableTextFieldSx}
                            {...form.register('email')}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="비밀번호"
                            type="password"
                            autoComplete="new-password"
                            error={Boolean(form.formState.errors.password)}
                            helperText={
                              form.formState.errors.password?.message ??
                              '8자 이상으로 설정해 주세요.'
                            }
                            sx={stableTextFieldSx}
                            {...form.register('password')}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="비밀번호 확인"
                            type="password"
                            autoComplete="new-password"
                            error={Boolean(
                              form.formState.errors.passwordConfirm
                            )}
                            helperText={
                              form.formState.errors.passwordConfirm?.message
                            }
                            sx={stableTextFieldSx}
                            {...form.register('passwordConfirm')}
                          />
                        </Grid>
                      </Grid>

                      <TermsAgreementSection form={form} />

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                      >
                        <Button
                          type="submit"
                          variant="contained"
                          size="large"
                          startIcon={<PersonAddAltRoundedIcon />}
                          disabled={isBusy}
                          sx={{ flex: 1, py: 1.2 }}
                        >
                          {isBusy ? '인증 메일 발송 중...' : '인증 메일 받기'}
                        </Button>
                        <Button
                          type="button"
                          variant="outlined"
                          size="large"
                          startIcon={<ArrowBackRoundedIcon />}
                          onClick={() => router.push('/login' as Route)}
                          sx={{ flex: 1, py: 1.2 }}
                        >
                          로그인으로 돌아가기
                        </Button>
                      </Stack>
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

function RegisterIntroPanel() {
  return (
    <Box
      sx={{
        minHeight: { xs: 260, md: '100%' },
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
        <Box
          sx={{
            display: 'inline-flex',
            lineHeight: 0
          }}
        >
          <BrandLogo
            priority
            sx={{
              width: { xs: 196, md: 214 },
              filter: 'drop-shadow(0 12px 24px rgba(6, 23, 79, 0.2))'
            }}
          />
        </Box>

        <Stack spacing={1.25}>
          <Typography
            variant="h3"
            sx={{
              maxWidth: 360,
              fontWeight: 900,
              fontSize: { xs: '2rem', md: '2.45rem' },
              lineHeight: 1.14,
              letterSpacing: 0
            }}
          >
            첫 운영 월을 준비하는 계정 설정
          </Typography>
          <Typography
            variant="body1"
            sx={{
              maxWidth: 360,
              color: alpha('#ffffff', 0.78),
              lineHeight: 1.75
            }}
          >
            가입과 동시에 운영 장부의 기준점을 만들고, 이메일 인증 후 수집
            거래부터 전표 흐름까지 이어갈 수 있습니다.
          </Typography>
        </Stack>
      </Stack>

      <Stack spacing={1.25} sx={{ mt: 4 }}>
        {benefitItems.map((item) => (
          <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
            <CheckCircleRoundedIcon sx={{ mt: 0.2, fontSize: 18 }} />
            <Typography
              variant="body2"
              sx={{ color: alpha('#ffffff', 0.76), lineHeight: 1.65 }}
            >
              {item}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function TermsAgreementSection({
  form
}: {
  form: ReturnType<typeof useForm<RegisterFormInput>>;
}) {
  const termsError = form.formState.errors.termsAccepted?.message;
  const privacyError = form.formState.errors.privacyConsentAccepted?.message;

  return (
    <Stack
      spacing={1.75}
      sx={{
        p: { xs: 1.75, md: 2 },
        borderRadius: '8px',
        border: '1px solid',
        borderColor: alpha(brandTokens.palette.primary, 0.08),
        bgcolor: brandTokens.palette.surfaceSoft
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={900}>
            필수 약관 확인
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            업무·회계성 데이터를 다루는 프로젝트 특성을 반영한 가입 조건입니다.
          </Typography>
        </Box>
        <Chip label="필수" size="small" color="primary" variant="outlined" />
      </Stack>

      <Box
        id="terms"
        sx={{
          maxHeight: 220,
          overflowY: 'auto',
          pr: 1,
          borderRadius: '8px',
          border: '1px solid',
          borderColor: alpha(brandTokens.palette.primary, 0.08),
          bgcolor: brandTokens.palette.surface
        }}
      >
        <Stack spacing={1.5} sx={{ p: 1.75 }}>
          <Typography variant="body2" fontWeight={900}>
            PERSONAL ERP 이용약관 주요 내용
          </Typography>
          {termsSections.map((section) => (
            <Box key={section.title}>
              <Typography variant="body2" fontWeight={800}>
                {section.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.35, lineHeight: 1.7 }}
              >
                {section.body}
              </Typography>
            </Box>
          ))}

          <Divider />

          <Typography variant="body2" fontWeight={900}>
            개인정보 수집·이용 동의
          </Typography>
          {privacyRows.map((row) => (
            <Grid key={row.label} container spacing={1}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant="caption" fontWeight={800}>
                  {row.label}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 9 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', lineHeight: 1.7 }}
                >
                  {row.value}
                </Typography>
              </Grid>
            </Grid>
          ))}
        </Stack>
      </Box>

      <Stack spacing={0.75}>
        <AgreementCheckbox
          name="termsAccepted"
          control={form.control}
          label={
            <>
              PERSONAL ERP 이용약관에 동의합니다.{' '}
              <MuiLink href="#terms" underline="hover">
                주요 내용 확인
              </MuiLink>
            </>
          }
          error={termsError}
        />
        <AgreementCheckbox
          name="privacyConsentAccepted"
          control={form.control}
          label="개인정보 수집·이용에 동의합니다."
          error={privacyError}
        />
      </Stack>
    </Stack>
  );
}

function AgreementCheckbox({
  name,
  control,
  label,
  error
}: {
  name: 'termsAccepted' | 'privacyConsentAccepted';
  control: ReturnType<typeof useForm<RegisterFormInput>>['control'];
  label: React.ReactNode;
  error?: string;
}) {
  return (
    <Box>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Checkbox
                checked={field.value}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.checked)}
                inputRef={field.ref}
              />
            }
            label={
              <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                {label}
              </Typography>
            }
          />
        )}
      />
      {error ? (
        <Typography variant="caption" color="error" sx={{ display: 'block' }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
