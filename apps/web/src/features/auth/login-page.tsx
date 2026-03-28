'use client';

import * as React from 'react';
import type { Route } from 'next';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
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
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { accessTokenStoragePolicy } from '@/shared/auth/auth-session-store';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type LoginFormInput = z.infer<typeof loginSchema>;

const loginHighlights = [
  {
    title: 'Protected by default',
    description:
      'The web app now treats dashboard routes as authenticated workspace screens.',
    icon: SecurityRoundedIcon
  },
  {
    title: 'Token-aware API client',
    description:
      'Protected requests automatically attach the bearer token and react to 401 responses.',
    icon: LockOpenRoundedIcon
  },
  {
    title: 'Deterministic boot flow',
    description:
      'Boot restores the current user through /auth/refresh before any protected page renders.',
    icon: TaskAltRoundedIcon
  }
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
        py: { xs: 4, md: 8 },
        background:
          'radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 38%), radial-gradient(circle at bottom right, rgba(15, 23, 42, 0.08), transparent 32%), #f5f7fb'
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={3} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card
              sx={{
                height: '100%',
                background:
                  'linear-gradient(160deg, rgba(15, 23, 42, 0.96), rgba(37, 99, 235, 0.92))',
                color: 'common.white'
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 5 }, height: '100%' }}>
                <Stack spacing={4} justifyContent="space-between" height="100%">
                  <Stack spacing={2.5}>
                    <Chip
                      label="Workspace Sign-in"
                      sx={{
                        alignSelf: 'flex-start',
                        color: 'common.white',
                        backgroundColor: 'rgba(255, 255, 255, 0.12)'
                      }}
                    />
                    <Box>
                      <Typography variant="h3" sx={{ maxWidth: 520 }}>
                        Personal ERP now boots from a real authenticated session.
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          mt: 2,
                          maxWidth: 560,
                          color: 'rgba(255, 255, 255, 0.76)'
                        }}
                      >
                        Sign in to restore your current user, unlock protected API
                        calls, and keep dashboard routes tied to an actual workspace
                        session.
                      </Typography>
                    </Box>
                  </Stack>

                  <Grid container spacing={2}>
                    {loginHighlights.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Grid key={item.title} size={{ xs: 12 }}>
                          <Box
                            sx={{
                              p: 2.25,
                              borderRadius: 4,
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.14)'
                            }}
                          >
                            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                              <Box
                                sx={{
                                  mt: 0.25,
                                  p: 1,
                                  borderRadius: 3,
                                  backgroundColor: 'rgba(255, 255, 255, 0.12)'
                                }}
                              >
                                <Icon fontSize="small" />
                              </Box>
                              <Box>
                                <Typography fontWeight={700}>{item.title}</Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ mt: 0.75, color: 'rgba(255, 255, 255, 0.72)' }}
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

          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: { xs: 3, md: 5 } }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Authentication
                    </Typography>
                    <Typography variant="h4" sx={{ mt: 0.5 }}>
                      Sign in to the workspace
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1.25 }}>
                      Access tokens stay in `{accessTokenStoragePolicy}` and are
                      restored through an HttpOnly refresh cookie via
                      `POST /auth/refresh`.
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label="Demo email: demo@example.com" />
                    <Chip label="Demo password: Demo1234!" />
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
                            : 'Sign-in failed.'
                        );
                      }
                    })}
                  >
                    <Stack spacing={2}>
                      <TextField
                        label="Email"
                        type="email"
                        autoComplete="email"
                        error={Boolean(form.formState.errors.email)}
                        helperText={form.formState.errors.email?.message}
                        {...form.register('email')}
                      />
                      <TextField
                        label="Password"
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
                        {isBusy ? 'Restoring session...' : 'Sign in'}
                      </Button>
                    </Stack>
                  </form>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 4,
                      backgroundColor: 'rgba(37, 99, 235, 0.06)',
                      border: '1px solid rgba(37, 99, 235, 0.12)'
                    }}
                  >
                    <Typography variant="subtitle2">
                      What happens after sign-in
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Protected queries attach `Authorization: Bearer &lt;token&gt;`.
                      If the API responds with `401`, the client tries one
                      `POST /auth/refresh` recovery before clearing the in-memory
                      session and returning to this screen.
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
