'use client';

import { Grid, Stack, TextField, Typography } from '@mui/material';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';
import { SettingsSectionNav } from '@/features/settings/settings-section-nav';

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
  OWNER: '소유자',
  MANAGER: '관리자',
  EDITOR: '편집자',
  VIEWER: '조회자'
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

  useDomainHelp({
    title: '작업 문맥 사용 가이드',
    description:
      '이 화면은 다른 메뉴를 사용하기 전에 현재 로그인 사용자가 어느 사업장, 권한, 장부 안에서 작업하는지 확인하는 시작 화면입니다. 데이터가 예상과 다르게 보이면 먼저 이 화면의 문맥을 확인합니다.',
    primaryEntity: '사업장 / 권한 / 장부',
    relatedEntities: [
      '운영 기간',
      '입출금 계정',
      '거래 유형',
      '수집 거래'
    ],
    truthSource:
      '현재 세션의 currentWorkspace가 모든 화면의 조회, 입력, 확정 권한을 해석하는 런타임 기준입니다.',
    supplementarySections: [
      {
        title: '바로 확인할 것',
        items: [
          '사업장 이름과 상태가 내가 작업하려는 사업장과 맞는지 확인합니다.',
          '멤버십 역할이 작업 목적과 맞는지 확인합니다. 월 마감과 공식 보고 생성은 역할에 따라 제한될 수 있습니다.',
          '현재 장부, 기준 통화, 시간대가 이후 월 운영과 전표의 기준이 됩니다.'
        ]
      },
      {
        title: '다음으로 갈 화면',
        items: [
          '문맥이 맞으면 기준 데이터에서 readiness와 자금수단/카테고리를 확인합니다.',
          '문맥이 비어 있거나 잘못 보이면 로그인 상태와 사업장 연결을 먼저 점검합니다.',
          '문맥이 맞는데 특정 화면 데이터가 이상하면 해당 화면의 기간 선택과 필터를 다시 확인합니다.'
        ]
      }
    ],
    readModelNote:
      '이 화면은 값을 수정하는 곳이 아니라, 앞으로 열 모든 운영 화면의 기준 문맥을 확인하는 곳입니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="작업 문맥"
        title="현재 작업 문맥"
        description="현재 로그인 사용자가 어떤 사업장과 장부 문맥 안에서 작업 중인지 확인합니다."
      />
      <SettingsSectionNav />
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard
            title="현재 작업 문맥"
            description="이 사용자가 지금 어떤 사업장과 장부를 기준으로 동작하는지 확인합니다."
          >
            <Stack spacing={appLayout.fieldGap}>
              <TextField
                label="사업장 이름"
                value={currentWorkspace?.tenant.name ?? '연결된 사업장 없음'}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="사업장 슬러그"
                value={currentWorkspace?.tenant.slug ?? '-'}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="사업장 상태"
                value={
                  currentWorkspace
                    ? (tenantStatusLabelMap[currentWorkspace.tenant.status] ??
                      currentWorkspace.tenant.status)
                    : '-'
                }
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="멤버십 역할"
                value={
                  currentWorkspace
                    ? (membershipRoleLabelMap[
                        currentWorkspace.membership.role
                      ] ?? currentWorkspace.membership.role)
                    : '-'
                }
                helperText="현재 로그인 사용자의 권한을 공식 작업 주체 기준으로 봅니다."
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="멤버십 상태"
                value={
                  currentWorkspace
                    ? (membershipStatusLabelMap[
                        currentWorkspace.membership.status
                      ] ?? currentWorkspace.membership.status)
                    : '-'
                }
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="현재 장부"
                value={currentWorkspace?.ledger?.name ?? '기본 장부 미선정'}
                helperText="이 장부 문맥 안에서 운영 기간, 수집 거래, 전표, 보고 화면이 함께 동작합니다."
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
                    ? (ledgerStatusLabelMap[currentWorkspace.ledger.status] ??
                      currentWorkspace.ledger.status)
                    : '-'
                }
                InputProps={{ readOnly: true }}
              />
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard
            title="세션 정보"
            description="현재 인증 상태와 작업 중인 사용자를 확인합니다."
          >
            <Stack spacing={appLayout.fieldGap}>
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
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
