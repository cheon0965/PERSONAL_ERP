'use client';

import { Grid, Stack, Switch, TextField, Typography } from '@mui/material';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { accessTokenStoragePolicy } from '@/shared/auth/auth-session-store';
import { webEnv, webRuntime } from '@/shared/config/env';
import { DomainContextCard } from '@/shared/ui/domain-context-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';

export default function SettingsPage() {
  const { status, user } = useAuthSession();
  const sessionStatusLabelMap: Record<string, string> = {
    loading: '확인 중',
    authenticated: '인증됨',
    unauthenticated: '미인증'
  };

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="설정"
        title="테넌트 / 운영 설정"
        description="Tenant, Ledger, 운영 기간 기준값과 실행 환경을 함께 확인하는 화면입니다."
      />

      <DomainContextCard
        description="설정 화면은 운영 환경과 기본값을 보여주지만, 실제 회계 저장을 직접 수정하는 화면은 아직 아닙니다."
        primaryEntity="테넌트 / 장부 (Tenant / Ledger)"
        relatedEntities={[
          '멤버십 (TenantMembership)',
          '운영 기간 (AccountingPeriod)',
          '자금수단 (FundingAccount)',
          '카테고리 (Category)'
        ]}
        truthSource="설정 값은 운영 기준을 제공하는 성격이며 공식 회계 확정은 전표와 스냅샷에 있습니다."
        readModelNote="현재 화면은 기본 운영값과 환경 상태를 보는 관리 보조 화면입니다."
      />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="기본 운영 값">
            <Stack spacing={appLayout.fieldGap}>
              <TextField
                label="기본 예비자금 (원)"
                defaultValue="400000"
                helperText="현재는 읽기 전용 기본값입니다. 실제 저장 기능은 월 운영 시작 화면과 함께 연결됩니다."
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="시간대"
                defaultValue="Asia/Seoul"
                helperText="현재는 읽기 전용 기본값입니다."
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="기본 운영 기간"
                defaultValue="2026-03"
                helperText="월 운영 시작 기능이 연결되기 전까지는 표시 전용 값입니다."
                InputProps={{ readOnly: true }}
              />
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard
            title="환경 / 세션"
            description="데모 동작과 현재 인증 상태를 함께 확인하는 영역입니다."
          >
            <Stack spacing={appLayout.fieldGap}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack spacing={0.5}>
                  <Typography>데모 대체 모드</Typography>
                  <Typography variant="body2" color="text.secondary">
                    개발 환경에서 `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`일 때만 활성화됩니다.
                  </Typography>
                </Stack>
                <Switch checked={webRuntime.demoFallbackEnabled} disabled />
              </Stack>
              <Stack spacing={0.5}>
                <Typography>실행 환경</Typography>
                <Typography variant="body2" color="text.secondary">
                  {webRuntime.nodeEnv}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography>API 기본 URL</Typography>
                <Typography variant="body2" color="text.secondary">
                  {webEnv.NEXT_PUBLIC_API_BASE_URL}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography>세션 상태</Typography>
                <Typography variant="body2" color="text.secondary">
                  {sessionStatusLabelMap[status] ?? status}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography>로그인 사용자</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user ? `${user.name} <${user.email}>` : '활성 세션 없음'}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography>액세스 토큰 저장 위치</Typography>
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