'use client';

import { Grid, Stack, Switch, TextField, Typography } from '@mui/material';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { accessTokenStoragePolicy } from '@/shared/auth/auth-session-store';
import { webEnv, webRuntime } from '@/shared/config/env';
import { DomainContextCard } from '@/shared/ui/domain-context-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';

const sessionStatusLabelMap: Record<string, string> = {
  loading: '확인 중',
  authenticated: '인증됨',
  unauthenticated: '미인증'
};

const tenantStatusLabelMap: Record<string, string> = {
  TRIAL: '체험',
  ACTIVE: '활성',
  SUSPENDED: '중지',
  ARCHIVED: '보관'
};

const membershipRoleLabelMap: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  EDITOR: 'Editor',
  VIEWER: 'Viewer'
};

const membershipStatusLabelMap: Record<string, string> = {
  INVITED: '초대됨',
  ACTIVE: '활성',
  SUSPENDED: '중지',
  REMOVED: '제거됨'
};

const ledgerStatusLabelMap: Record<string, string> = {
  ACTIVE: '활성',
  SUSPENDED: '중지',
  ARCHIVED: '보관'
};

export default function SettingsPage() {
  const { status, user } = useAuthSession();
  const currentWorkspace = user?.currentWorkspace ?? null;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="설정"
        title="테넌트 / 장부 기준"
        description="Round 1 기준선에서는 현재 로그인 사용자가 어떤 TenantMembership과 Ledger 문맥 안에서 작업하는지 먼저 확인합니다."
      />

      <DomainContextCard
        description="이 화면은 현재 작업 문맥을 보여주는 운영 기준 화면입니다. 실제 기간 시작, 전표 확정, 마감은 이후 라운드에서 이 문맥 위에 연결됩니다."
        primaryEntity="테넌트 / 멤버십 / 장부 (Tenant / TenantMembership / Ledger)"
        relatedEntities={[
          '운영 기간 (AccountingPeriod)',
          '자금수단 (FundingAccount)',
          '거래유형 (TransactionType)',
          '수집 거래 (CollectedTransaction)'
        ]}
        truthSource="지금 단계의 공식 기준은 현재 작업 TenantMembership과 Ledger를 해석하는 런타임 문맥입니다."
        readModelNote="현재 화면은 기준선 확인용이며, 기간 생성과 마감 같은 실제 쓰기 기능은 후속 라운드에서 붙습니다."
      />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard
            title="현재 작업 문맥"
            description="이 사용자가 지금 어떤 테넌트와 장부를 기준으로 동작하는지 확인합니다."
          >
            <Stack spacing={appLayout.fieldGap}>
              <TextField
                label="테넌트 이름"
                value={currentWorkspace?.tenant.name ?? '연결된 테넌트 없음'}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="테넌트 슬러그"
                value={currentWorkspace?.tenant.slug ?? '-'}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="테넌트 상태"
                value={
                  currentWorkspace
                    ? tenantStatusLabelMap[currentWorkspace.tenant.status] ??
                      currentWorkspace.tenant.status
                    : '-'
                }
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="멤버십 역할"
                value={
                  currentWorkspace
                    ? membershipRoleLabelMap[currentWorkspace.membership.role] ??
                      currentWorkspace.membership.role
                    : '-'
                }
                helperText="Round 1에서는 현재 로그인 사용자의 TenantMembership을 공식 작업 주체 기준으로 봅니다."
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="멤버십 상태"
                value={
                  currentWorkspace
                    ? membershipStatusLabelMap[
                        currentWorkspace.membership.status
                      ] ?? currentWorkspace.membership.status
                    : '-'
                }
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="현재 장부"
                value={currentWorkspace?.ledger?.name ?? '기본 장부 미선정'}
                helperText="다음 Round에서는 이 장부 문맥 안에서 AccountingPeriod를 열게 됩니다."
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="장부 통화 / 시간대"
                value={
                  currentWorkspace?.ledger
                    ? `${currentWorkspace.ledger.baseCurrency} / ${currentWorkspace.ledger.timezone}`
                    : '-'
                }
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="장부 상태"
                value={
                  currentWorkspace?.ledger
                    ? ledgerStatusLabelMap[currentWorkspace.ledger.status] ??
                      currentWorkspace.ledger.status
                    : '-'
                }
                InputProps={{ readOnly: true }}
              />
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard
            title="환경 / 세션"
            description="개발 환경과 현재 인증 세션 상태를 함께 확인합니다."
          >
            <Stack spacing={appLayout.fieldGap}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Stack spacing={0.5}>
                  <Typography>데모 대체 모드</Typography>
                  <Typography variant="body2" color="text.secondary">
                    개발 환경에서만 `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`일 때
                    활성화됩니다.
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
                <Typography>액세스 토큰 보관 위치</Typography>
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
