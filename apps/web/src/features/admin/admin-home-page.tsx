'use client';

import Link from 'next/link';
import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';
import { AdminSectionNav } from './admin-section-nav';
import { readMembershipRoleLabel } from './admin-labels';

export function AdminHomePage() {
  const { user } = useAuthSession();
  const role = user?.currentWorkspace?.membership.role ?? null;
  const workspaceLabel = user?.currentWorkspace
    ? `${user.currentWorkspace.tenant.name} (${user.currentWorkspace.tenant.slug})`
    : '-';
  const canReadMembers = role === 'OWNER' || role === 'MANAGER';
  const canReadNavigation = role === 'OWNER' || role === 'MANAGER';
  const canUpdateNavigation = role === 'OWNER';
  const canReadLogs = role === 'OWNER';
  const canReadPolicy = role === 'OWNER' || role === 'MANAGER';
  const accessibleCount = [
    canReadMembers,
    canReadNavigation,
    canReadLogs,
    canReadPolicy
  ].filter(Boolean).length;
  const priorityCards = [
    {
      eyebrow: '멤버 운영',
      title: '회원 관리',
      value: canReadMembers ? '사용 가능' : '권한 필요',
      detail: canReadMembers
        ? '멤버 목록 확인과 초대 시작이 가능합니다. 역할·상태 변경은 소유자만 실행합니다.'
        : '소유자 또는 관리자 권한이 있어야 멤버 목록과 초대 흐름을 확인할 수 있습니다.',
      href: '/admin/members',
      actionLabel: '회원 관리 열기',
      tone: canReadMembers ? 'success' : 'warning'
    },
    {
      eyebrow: '메뉴 권한',
      title: '메뉴 / 권한',
      value: canUpdateNavigation
        ? '편집 가능'
        : canReadNavigation
          ? '조회 가능'
          : '권한 필요',
      detail: canUpdateNavigation
        ? 'DB에 저장된 트리 메뉴와 메뉴별 역할 노출을 바로 조정할 수 있습니다.'
        : canReadNavigation
          ? '메뉴 권한 구조는 확인할 수 있고, 변경은 소유자에게 요청합니다.'
          : '메뉴 권한 관리는 소유자 또는 관리자 권한에서 확인할 수 있습니다.',
      href: '/admin/navigation',
      actionLabel: '메뉴 권한 열기',
      tone: canReadNavigation ? 'success' : 'warning'
    },
    {
      eyebrow: '감사 추적',
      title: '로그 관리',
      value: canReadLogs ? '소유자 전용 열림' : '비공개',
      detail: canReadLogs
        ? 'requestId 기준으로 멤버 관리 명령과 감사 이벤트를 바로 추적할 수 있습니다.'
        : '감사 로그 조회는 소유자 권한에서만 열립니다.',
      href: '/admin/logs',
      actionLabel: '로그 관리 열기',
      tone: canReadLogs ? 'success' : 'warning'
    },
    {
      eyebrow: '운영 기준',
      title: '권한 정책',
      value: canReadPolicy ? '표 기준 확인 가능' : '권한 필요',
      detail: canReadPolicy
        ? '역할별 메뉴 노출과 접근 기준을 표로 확인해 운영 화면 정책을 맞출 수 있습니다.'
        : '정책 기준표는 소유자 또는 관리자 권한에서만 확인할 수 있습니다.',
      href: '/admin/policy',
      actionLabel: '권한 정책 열기',
      tone: canReadPolicy ? 'success' : 'warning'
    }
  ] as const;
  const groupedLinks = [
    {
      title: '권한 운영',
      description: '사용자와 역할 변경이 필요한 흐름을 한 묶음으로 봅니다.',
      items: [
        {
          title: '회원 관리',
          description:
            '멤버 초대, 역할 변경, 상태 조정이 필요한 경우 가장 먼저 확인하는 화면입니다.',
          href: '/admin/members',
          actionLabel: '회원 관리 열기',
          disabled: !canReadMembers
        },
        {
          title: '메뉴 / 권한',
          description:
            '사이드바 트리 메뉴와 메뉴별 허용 역할을 DB 기준으로 관리합니다.',
          href: '/admin/navigation',
          actionLabel: '메뉴 권한 열기',
          disabled: !canReadNavigation
        },
        {
          title: '권한 정책',
          description:
            '운영 화면별 접근 기준과 버튼 노출 정책을 확인할 때 사용합니다.',
          href: '/admin/policy',
          actionLabel: '정책 기준 보기',
          disabled: !canReadPolicy
        }
      ]
    },
    {
      title: '감사 / 추적',
      description: '관리 명령이 실제로 어떻게 실행됐는지 감사 흐름을 분리해 봅니다.',
      items: [
        {
          title: '로그 관리',
          description:
            'requestId, 결과, 이벤트명 기준으로 관리자 작업 흔적을 추적합니다.',
          href: '/admin/logs',
          actionLabel: '로그 관리 열기',
          disabled: !canReadLogs
        }
      ]
    }
  ] as const;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title="관리자 허브"
        description="현재 사업장 문맥에서 권한 운영과 감사 추적 중 지금 확인해야 할 항목을 먼저 정리합니다."
        badges={[
          {
            label: readMembershipRoleLabel(role),
            color: canReadMembers ? 'primary' : 'default'
          },
          {
            label: `${accessibleCount}개 화면 접근 가능`,
            color: accessibleCount >= 2 ? 'success' : 'warning'
          }
        ]}
        metadata={[
          { label: '사업장', value: workspaceLabel },
          {
            label: '멤버 관리',
            value: canReadMembers ? '확인 가능' : '권한 필요'
          },
          {
            label: '메뉴 권한',
            value: canReadNavigation
              ? canUpdateNavigation
                ? '편집 가능'
                : '조회 가능'
              : '권한 필요'
          },
          {
            label: '감사 로그',
            value: canReadLogs ? '조회 가능' : '소유자 전용'
          },
          {
            label: '정책 기준',
            value: canReadPolicy ? '확인 가능' : '권한 필요'
          }
        ]}
        primaryActionLabel="회원 관리 열기"
        primaryActionHref="/admin/members"
        primaryActionDisabled={!canReadMembers}
        secondaryActionLabel="로그 관리"
        secondaryActionHref="/admin/logs"
        secondaryActionDisabled={!canReadLogs}
      />

      <AdminSectionNav />

      {!canReadMembers ? (
        <Alert severity="warning" variant="outlined">
          관리자 영역은 소유자 또는 관리자 권한에서 사용할 수 있습니다. 현재
          권한은 {readMembershipRoleLabel(role)} 입니다.
        </Alert>
      ) : null}

      <SectionCard
        title="지금 우선 확인"
        description="관리 링크 모음보다 먼저, 현재 권한에서 바로 열 수 있는 핵심 관리 작업을 압축해 보여줍니다."
      >
        <Grid container spacing={appLayout.sectionGap}>
          {priorityCards.map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 6, xl: 3 }}>
              <AdminPriorityCard {...item} />
            </Grid>
          ))}
        </Grid>
      </SectionCard>

      <Stack spacing={appLayout.sectionGap}>
        {groupedLinks.map((group) => (
          <SectionCard
            key={group.title}
            title={group.title}
            description={group.description}
          >
            <Grid container spacing={appLayout.sectionGap}>
              {group.items.map((item) => (
                <Grid key={item.title} size={{ xs: 12, md: 6, xl: 4 }}>
                  <AdminLinkCard {...item} />
                </Grid>
              ))}
            </Grid>
          </SectionCard>
        ))}
      </Stack>
    </Stack>
  );
}

function AdminPriorityCard({
  eyebrow,
  title,
  value,
  detail,
  href,
  actionLabel,
  tone
}: {
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  href: string;
  actionLabel: string;
  tone: 'success' | 'warning';
}) {
  return (
    <Stack
      spacing={1.5}
      sx={{
        height: '100%',
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: tone === 'success' ? 'success.light' : 'warning.light',
        backgroundColor: tone === 'success' ? 'success.50' : 'warning.50'
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        spacing={1}
        alignItems="flex-start"
      >
        <Typography variant="overline" color="text.secondary">
          {eyebrow}
        </Typography>
        <Chip
          label={tone === 'success' ? '확인 가능' : '권한 확인'}
          size="small"
          color={tone}
          variant="outlined"
        />
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {detail}
      </Typography>
      <div>
        <Button component={Link} href={href} variant="contained" color={tone}>
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}

function AdminLinkCard({
  title,
  description,
  href,
  actionLabel,
  disabled
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  disabled?: boolean;
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
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <div>
        <Button component={Link} href={href} variant="outlined" disabled={disabled}>
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}
