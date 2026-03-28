'use client';

import { Grid, Stack, Switch, TextField, Typography } from '@mui/material';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { accessTokenStoragePolicy } from '@/shared/auth/auth-session-store';
import { webEnv, webRuntime } from '@/shared/config/env';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';

export default function SettingsPage() {
  const { status, user } = useAuthSession();

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Settings"
        title="Workspace Settings"
        description="Adjust baseline reserve, timezone, and demo-oriented workspace switches."
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Financial Defaults">
            <Stack spacing={2}>
              <TextField label="Minimum Reserve (KRW)" defaultValue="400000" />
              <TextField label="Timezone" defaultValue="Asia/Seoul" />
              <TextField label="Default Forecast Month" defaultValue="2026-03" />
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard
            title="Runtime Modes"
            description="Fallback behavior is controlled by environment variables, not by an in-app toggle."
          >
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack spacing={0.5}>
                  <Typography>Demo fallback mode</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Enabled only in development when `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`.
                  </Typography>
                </Stack>
                <Switch checked={webRuntime.demoFallbackEnabled} disabled />
              </Stack>
              <Stack spacing={0.5}>
                <Typography>Runtime environment</Typography>
                <Typography variant="body2" color="text.secondary">
                  {webRuntime.nodeEnv}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography>API base URL</Typography>
                <Typography variant="body2" color="text.secondary">
                  {webEnv.NEXT_PUBLIC_API_BASE_URL}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography>Session status</Typography>
                <Typography variant="body2" color="text.secondary">
                  {status}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography>Signed-in user</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user ? `${user.name} <${user.email}>` : 'No active session'}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography>Access token storage</Typography>
                <Typography variant="body2" color="text.secondary">
                  {accessTokenStoragePolicy}
                </Typography>
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
