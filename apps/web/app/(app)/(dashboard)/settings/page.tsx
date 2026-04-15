'use client';

import Link from 'next/link';
import { Button, Chip, Grid, Stack, Typography } from '@mui/material';
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
        eyebrow="설정"
        title="현재 작업 문맥"
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
                },
                {
                  label: '해석 기준',
                  value: '현재 로그인 사용자의 공식 작업 권한'
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
                  value: user ? `${user.name} <${user.email}>` : '활성 세션 없음'
                },
                {
                  label: '확인 포인트',
                  value: '데이터가 다르면 이 문맥과 기간 필터를 먼저 점검'
                }
              ]}
            />
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title="다음으로 갈 화면"
        description="문맥이 맞다면 아래 순서로 운영 준비와 설정 화면을 이어서 확인합니다."
      >
        <Grid container spacing={appLayout.sectionGap}>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <SettingsActionCard
              eyebrow="운영 준비"
              title="기준 데이터"
              description="자금수단, 카테고리, 공식 참조 기준이 준비됐는지 먼저 확인합니다."
              href="/reference-data"
              actionLabel="준비 상태 보기"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <SettingsActionCard
              eyebrow="월 실행"
              title="운영 월"
              description="현재 장부 문맥에서 열린 운영 월과 마감 이력을 확인합니다."
              href="/periods"
              actionLabel="운영 월 보기"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <SettingsActionCard
              eyebrow="설정"
              title="사업장"
              description="사업장 이름, 상태, 통화, 시간대 같은 기본 기준값을 관리합니다."
              href="/settings/workspace"
              actionLabel="사업장 설정"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <SettingsActionCard
              eyebrow="보안"
              title="내 계정"
              description="이름, 비밀번호, 세션 종료 같은 사용자 보안 설정을 직접 관리합니다."
              href="/settings/account"
              actionLabel="내 계정 보기"
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

function SettingsActionCard({
  eyebrow,
  title,
  description,
  href,
  actionLabel
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
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
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="overline" color="text.secondary">
          {eyebrow}
        </Typography>
        <Chip label="바로 이동" size="small" variant="outlined" />
      </Stack>
      <Typography variant="subtitle1">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <div>
        <Button component={Link} href={href} variant="outlined">
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}
