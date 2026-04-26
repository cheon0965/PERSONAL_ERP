'use client';

import Link from 'next/link';
import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';
import { readMembershipRoleLabel } from './admin-labels';

export function AdminHomePage() {
  const { user } = useAuthSession();
  const isSystemAdmin = user?.isSystemAdmin === true;
  const role = user?.currentWorkspace?.membership.role ?? null;
  const roleLabel = isSystemAdmin
    ? '전체 관리자'
    : readMembershipRoleLabel(role);
  const workspaceLabel = isSystemAdmin
    ? '전체 사업장'
    : user?.currentWorkspace
      ? `${user.currentWorkspace.tenant.name} (${user.currentWorkspace.tenant.slug})`
      : '-';
  const canReadMembers =
    isSystemAdmin || role === 'OWNER' || role === 'MANAGER';
  const canReadSystemUsers = isSystemAdmin;
  const canReadTenants = isSystemAdmin;
  const canUseSupportContext = isSystemAdmin;
  const canReadOperationsStatus = isSystemAdmin;
  const canReadNavigation = role === 'OWNER' || role === 'MANAGER';
  const canUpdateNavigation = role === 'OWNER';
  const canReadLogs = isSystemAdmin || role === 'OWNER';
  const canReadSecurityThreats = isSystemAdmin;
  const canReadPolicy = role === 'OWNER' || role === 'MANAGER';
  const accessibleCount = [
    canReadMembers,
    canReadSystemUsers,
    canReadTenants,
    canUseSupportContext,
    canReadOperationsStatus,
    canReadNavigation,
    canReadLogs,
    canReadSecurityThreats,
    canReadPolicy
  ].filter(Boolean).length;
  const priorityCards = [
    {
      eyebrow: '계정 운영',
      title: '전체 사용자 관리',
      value: canReadSystemUsers ? '계정 관리 가능' : '전체 관리자 전용',
      detail: canReadSystemUsers
        ? '사용자 계정 상태, 전체 관리자 권한, 이메일 인증 보정, 세션 만료를 한 화면에서 처리합니다.'
        : '전체 사용자 관리는 플랫폼 전체 계정을 다루므로 전체 관리자만 사용할 수 있습니다.',
      href: '/admin/users',
      actionLabel: '전체 사용자 관리 열기',
      tone: canReadSystemUsers ? 'success' : 'warning'
    },
    {
      eyebrow: '사업장 운영',
      title: '사업장 관리',
      value: canReadTenants ? '사업장 점검 가능' : '전체 관리자 전용',
      detail: canReadTenants
        ? '사업장 상태, 기본 장부, 멤버 수, 소유자 구성처럼 운영 진입 전에 필요한 기준을 확인합니다.'
        : '사업장 관리는 전체 관리자 권한에서만 사용할 수 있습니다.',
      href: '/admin/tenants',
      actionLabel: '사업장 관리 열기',
      tone: canReadTenants ? 'success' : 'warning'
    },
    {
      eyebrow: '지원 모드',
      title: '사업장 전환 / 지원 모드',
      value: canUseSupportContext ? '문맥 선택 가능' : '전체 관리자 전용',
      detail: canUseSupportContext
        ? '다른 사용자로 가장하지 않고 전체 관리자 세션에 사업장과 장부 문맥을 연결해 운영 화면을 확인합니다.'
        : '지원 모드는 전체 관리자만 사용할 수 있습니다.',
      href: '/admin/support-context',
      actionLabel: '지원 모드 열기',
      tone: canUseSupportContext ? 'success' : 'warning'
    },
    {
      eyebrow: '운영 점검',
      title: '운영 상태',
      value: canReadOperationsStatus ? '상태 점검 가능' : '전체 관리자 전용',
      detail: canReadOperationsStatus
        ? '사용자, 사업장, DB, 보안 위협, 감사 실패 지표를 배포 후 점검판으로 확인합니다.'
        : '운영 상태는 전체 관리자만 조회할 수 있습니다.',
      href: '/admin/operations',
      actionLabel: '운영 상태 열기',
      tone: canReadOperationsStatus ? 'success' : 'warning'
    },
    {
      eyebrow: '멤버 운영',
      title: '회원 관리',
      value: canReadMembers ? '사용 가능' : '권한 필요',
      detail: canReadMembers
        ? isSystemAdmin
          ? '모든 사업장의 멤버 목록을 확인하고 역할·상태를 조정할 수 있습니다.'
          : '멤버 목록 확인과 초대 시작이 가능합니다. 역할·상태 변경은 소유자만 실행합니다.'
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
        ? '저장된 메뉴 구조와 메뉴별 역할 노출을 바로 조정할 수 있습니다.'
        : canReadNavigation
          ? '메뉴 권한 구조는 확인할 수 있고, 변경은 소유자에게 요청합니다.'
          : '메뉴 권한 관리는 소유자 또는 관리자 권한에서 확인할 수 있습니다.',
      href: '/admin/navigation',
      actionLabel: '메뉴 권한 열기',
      tone: canReadNavigation ? 'success' : 'warning'
    },
    {
      eyebrow: '보안 감지',
      title: '보안 위협 로그',
      value: canReadSecurityThreats ? '전체 관리자 전용' : '비공개',
      detail: canReadSecurityThreats
        ? '로그인 실패, 가입 제한, 세션 재사용, 출처 차단, 권한 거부 같은 위협성 이벤트를 별도로 확인합니다.'
        : '보안 위협 로그는 전체 관리자만 확인할 수 있습니다.',
      href: '/admin/security-threats',
      actionLabel: '보안 위협 로그 열기',
      tone: canReadSecurityThreats ? 'success' : 'warning'
    },
    {
      eyebrow: '감사 추적',
      title: '로그 관리',
      value: canReadLogs
        ? isSystemAdmin
          ? '전체 로그 열림'
          : '소유자 전용 열림'
        : '비공개',
      detail: canReadLogs
        ? isSystemAdmin
          ? '모든 사업장의 관리자 작업과 감사 이벤트를 requestId 기준으로 추적할 수 있습니다.'
          : 'requestId 기준으로 멤버 관리 명령과 감사 이벤트를 바로 추적할 수 있습니다.'
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
      title: '플랫폼 운영',
      description:
        '전체 관리자 권한으로 계정, 사업장, 지원 문맥, 운영 상태를 먼저 확인합니다.',
      items: [
        {
          title: '전체 사용자 관리',
          description:
            '계정 잠금, 세션 만료, 이메일 인증 보정, 전체 관리자 권한 변경을 처리합니다.',
          href: '/admin/users',
          actionLabel: '사용자 관리 열기',
          disabled: !canReadSystemUsers
        },
        {
          title: '사업장 관리',
          description:
            '사업장 상태와 기본 장부 구성을 확인하고 운영 진입 가능 여부를 점검합니다.',
          href: '/admin/tenants',
          actionLabel: '사업장 관리 열기',
          disabled: !canReadTenants
        },
        {
          title: '사업장 전환 / 지원 모드',
          description:
            '전체 관리자 세션의 사업장과 장부 문맥을 선택해 운영 화면을 확인합니다.',
          href: '/admin/support-context',
          actionLabel: '지원 모드 열기',
          disabled: !canUseSupportContext
        },
        {
          title: '운영 상태',
          description:
            '최근 24시간 보안 위협, 감사 실패, DB/API 점검 상태를 한 번에 확인합니다.',
          href: '/admin/operations',
          actionLabel: '운영 상태 열기',
          disabled: !canReadOperationsStatus
        }
      ]
    },
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
          description: '사이드바 메뉴 구조와 메뉴별 허용 역할을 관리합니다.',
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
      description:
        '관리 명령이 실제로 어떻게 실행됐는지 감사 흐름을 분리해 봅니다.',
      items: [
        {
          title: '보안 위협 로그',
          description:
            '비정상 로그인, 가입 제한, 세션 재사용, 권한 거부처럼 보안상 의심되는 이벤트를 별도로 확인합니다.',
          href: '/admin/security-threats',
          actionLabel: '보안 위협 로그 열기',
          disabled: !canReadSecurityThreats
        },
        {
          title: '로그 관리',
          description:
            '요청번호, 결과, 이벤트명 기준으로 관리자 작업 흔적을 추적합니다.',
          href: '/admin/logs',
          actionLabel: '로그 관리 열기',
          disabled: !canReadLogs
        }
      ]
    }
  ] as const;

  useDomainHelp({
    title: '관리자 화면 가이드',
    description:
      '관리자 화면은 사용자, 사업장, 지원 모드, 운영 상태, 멤버, 메뉴 권한, 보안 위협 로그, 감사 로그, 정책 기준을 분리해서 운영하는 영역입니다.',
    primaryEntity: '전체 관리자 운영',
    relatedEntities: [
      '전체 사용자',
      '사업장',
      '지원 문맥',
      '운영 상태',
      '보안 위협 로그',
      '감사 로그'
    ],
    truthSource:
      '실제 권한과 메뉴 노출 기준은 저장된 메뉴 구조와 멤버 역할입니다.',
    supplementarySections: [
      {
        title: '이 화면에서 하는 일',
        items: [
          '현재 역할로 접근 가능한 관리자 기능을 먼저 확인합니다.',
          '전체 사용자 관리, 사업장 관리, 지원 모드, 운영 상태, 멤버 관리, 메뉴 권한, 보안 위협 추적, 감사 추적, 정책 확인 화면으로 이동합니다.'
        ]
      },
      {
        title: '주의할 점',
        items: [
          '전체 관리자는 모든 사업장과 사용자를 한 번에 확인할 수 있습니다.',
          '지원 모드는 다른 사용자로 가장하지 않고 현재 전체 관리자 세션에만 사업장 문맥을 연결합니다.',
          '소유자만 실제 멤버 역할 변경과 메뉴 권한 편집을 수행합니다.',
          '정책 화면은 현재 메뉴 기준을 읽는 확인용 화면입니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '전체 사용자 관리',
            href: '/admin/users',
            description:
              '사용자 상태, 세션, 이메일 인증, 전체 관리자 권한을 확인합니다.',
            actionLabel: '전체 사용자 관리 열기'
          },
          {
            title: '사업장 관리',
            href: '/admin/tenants',
            description: '사업장 상태, 기본 장부, 멤버 구성을 확인합니다.',
            actionLabel: '사업장 관리 열기'
          },
          {
            title: '운영 상태',
            href: '/admin/operations',
            description:
              '배포 후 사용자, 사업장, 보안, 감사 지표를 빠르게 점검합니다.',
            actionLabel: '운영 상태 열기'
          },
          {
            title: '보안 위협 로그',
            href: '/admin/security-threats',
            description:
              '로그인 실패, 가입 제한, 세션 재사용 감지처럼 보안상 의심되는 이벤트를 확인합니다.',
            actionLabel: '보안 위협 로그 열기'
          },
          {
            title: '감사 로그',
            href: '/admin/logs',
            description:
              '관리자 작업과 접근 거부 흐름을 요청번호 기준으로 추적합니다.',
            actionLabel: '감사 로그 열기'
          }
        ]
      }
    ]
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title="관리자 허브"
        description={
          isSystemAdmin
            ? '전체 사업장의 권한 운영과 감사 추적 중 지금 확인해야 할 항목을 먼저 정리합니다.'
            : '현재 사업장에서 권한 운영과 감사 추적 중 지금 확인해야 할 항목을 먼저 정리합니다.'
        }
        badges={[
          {
            label: roleLabel,
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
        metadataSingleRow
        primaryActionLabel="회원 관리 열기"
        primaryActionHref="/admin/members"
        primaryActionDisabled={!canReadMembers}
        secondaryActionLabel="로그 관리"
        secondaryActionHref="/admin/logs"
        secondaryActionDisabled={!canReadLogs}
      />
      {!canReadMembers ? (
        <Alert severity="warning" variant="outlined">
          관리자 영역은 소유자 또는 관리자 권한에서 사용할 수 있습니다. 현재
          권한은 {roleLabel} 입니다.
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
        backgroundColor:
          tone === 'success'
            ? brandTokens.palette.successSoft
            : brandTokens.palette.warningSoft
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
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', lineHeight: 1.7 }}
      >
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
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: '-webkit-box',
          overflow: 'hidden',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          lineHeight: 1.7
        }}
      >
        {description}
      </Typography>
      <div>
        <Button
          component={Link}
          href={href}
          variant="outlined"
          disabled={disabled}
        >
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}
