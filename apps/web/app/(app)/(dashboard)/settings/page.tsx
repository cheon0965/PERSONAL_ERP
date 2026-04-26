'use client';

import { Grid, Stack, Typography } from '@mui/material';
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
    title: '현재 이용 기준 안내',
    description:
      '이 화면은 다른 메뉴를 사용하기 전에 현재 로그인 사용자가 어느 사업장, 권한, 장부 기준으로 보고 있는지 확인하는 시작 화면입니다. 데이터가 예상과 다르게 보이면 먼저 이 화면의 기준 정보를 확인합니다.',
    primaryEntity: '사업장 / 권한 / 장부',
    relatedEntities: ['운영 기간', '입출금 계정', '거래 유형', '수집 거래'],
    truthSource:
      '현재 로그인 중인 사업장과 장부 정보가 모든 화면의 조회, 입력, 확정 권한을 판단하는 기준입니다.',
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
        title: '이어지는 화면',
        items: [
          '사업장과 장부가 맞으면 기준 데이터에서 준비 상태와 자금수단/카테고리를 확인합니다.',
          '사업장 정보가 비어 있거나 잘못 보이면 로그인 상태와 사업장 연결을 먼저 점검합니다.',
          '사업장과 장부가 맞는데 특정 화면 데이터가 이상하면 해당 화면의 기간 선택과 필터를 다시 확인합니다.'
        ],
        links: [
          {
            title: '기준 데이터 준비 상태',
            description: '운영 준비가 충분한지 먼저 점검하고 자금수단과 카테고리를 이어서 확인합니다.',
            href: '/reference-data',
            actionLabel: '기준 데이터 보기'
          },
          {
            title: '운영 기간',
            description: '현재 사업장과 장부 기준이 맞다면 월 운영 시작과 마감 상태를 확인합니다.',
            href: '/periods',
            actionLabel: '운영 기간 보기'
          },
          {
            title: '사업장 설정',
            description: '사업장 이름, 슬러그, 장부 연결 같은 기준값을 직접 수정합니다.',
            href: '/settings/workspace',
            actionLabel: '사업장 설정 보기'
          },
          {
            title: '기본 정보',
            description: '내 계정 이름과 개인 보안 정보를 이어서 확인합니다.',
            href: '/settings/account/profile',
            actionLabel: '기본 정보 보기'
          }
        ]
      }
    ],
    readModelNote:
      '이 화면은 값을 수정하는 곳이 아니라, 앞으로 열 모든 운영 화면의 기준 정보를 확인하는 곳입니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="설정"
        title="현재 사업장 / 장부"
        description="지금 보고 있는 사업장, 권한, 장부 기준을 먼저 확인하고 다음 운영 화면으로 이동합니다."
        badges={[
          {
            label: sessionStatusLabelMap[status] ?? status,
            color: status === 'authenticated' ? 'success' : 'default'
          },
          {
            label: currentWorkspace
              ? (membershipRoleLabelMap[currentWorkspace.membership.role] ??
                currentWorkspace.membership.role)
              : '사업장 미연결',
            color: currentWorkspace ? 'primary' : 'warning'
          }
        ]}
        metadata={[
          {
            label: '사업장',
            value: currentWorkspace?.tenant.name ?? '연결된 사업장 없음'
          },
          {
            label: '장부',
            value: currentWorkspace?.ledger?.name ?? '기본 장부 미선정'
          },
          {
            label: '통화 / 시간대',
            value: currentWorkspace?.ledger
              ? `${currentWorkspace.ledger.baseCurrency} / ${currentWorkspace.ledger.timezone}`
              : '-'
          },
          {
            label: '사용자',
            value: user ? `${user.name} <${user.email}>` : '활성 세션 없음'
          }
        ]}
        metadataSingleRow
        primaryActionLabel="기준 데이터 보기"
        primaryActionHref="/reference-data"
        secondaryActionLabel="사업장 설정"
        secondaryActionHref="/settings/workspace"
      />
      <SettingsSectionNav />

      <SectionCard
        title="현재 작업 기준"
        description="입력 화면처럼 길게 읽기보다, 지금 적용되는 사업장·권한·장부 기준을 한 번에 확인합니다."
      >
        <Grid container spacing={appLayout.sectionGap}>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <ContextInfoCard
              title="사업장"
              items={[
                {
                  label: '이름',
                  value: currentWorkspace?.tenant.name ?? '연결된 사업장 없음'
                },
                {
                  label: '슬러그',
                  value: currentWorkspace?.tenant.slug ?? '-'
                },
                {
                  label: '상태',
                  value: currentWorkspace
                    ? (tenantStatusLabelMap[currentWorkspace.tenant.status] ??
                      currentWorkspace.tenant.status)
                    : '-'
                }
              ]}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <ContextInfoCard
              title="멤버십"
              items={[
                {
                  label: '역할',
                  value: currentWorkspace
                    ? (membershipRoleLabelMap[
                        currentWorkspace.membership.role
                      ] ?? currentWorkspace.membership.role)
                    : '-'
                },
                {
                  label: '상태',
                  value: currentWorkspace
                    ? (membershipStatusLabelMap[
                        currentWorkspace.membership.status
                      ] ?? currentWorkspace.membership.status)
                    : '-'
                }
              ]}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <ContextInfoCard
              title="장부"
              items={[
                {
                  label: '현재 장부',
                  value: currentWorkspace?.ledger?.name ?? '기본 장부 미선정'
                },
                {
                  label: '통화 / 시간대',
                  value: currentWorkspace?.ledger
                    ? `${currentWorkspace.ledger.baseCurrency} / ${currentWorkspace.ledger.timezone}`
                    : '-'
                },
                {
                  label: '상태',
                  value: currentWorkspace?.ledger
                    ? (ledgerStatusLabelMap[currentWorkspace.ledger.status] ??
                      currentWorkspace.ledger.status)
                    : '-'
                }
              ]}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <ContextInfoCard
              title="세션"
              items={[
                {
                  label: '인증 상태',
                  value: sessionStatusLabelMap[status] ?? status
                },
                {
                  label: '사용자',
                  value: user
                    ? `${user.name} <${user.email}>`
                    : '활성 세션 없음'
                }
              ]}
            />
          </Grid>
        </Grid>
      </SectionCard>
    </Stack>
  );
}

function ContextInfoCard({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <Stack
      spacing={1.5}
      sx={{
        height: '100%',
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default'
      }}
    >
      <Typography variant="subtitle1">{title}</Typography>
      <Stack spacing={1.25}>
        {items.map((item) => (
          <Stack key={item.label} spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {item.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
