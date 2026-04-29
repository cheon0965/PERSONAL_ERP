'use client';

import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Stack, TextField, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  AccountSessionItem,
  ChangePasswordRequest
} from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resendVerificationEmail } from '@/features/auth/auth.api';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import {
  accountAvatarOptions,
  useAccountAvatar
} from '@/shared/auth/account-avatar';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { formatDateTime } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  accountSecurityQueryKey,
  changePassword,
  getAccountSecurityOverview,
  revokeAccountSession,
  updateAccountProfile
} from './settings.api';
import { readAccountSecurityEventLabel } from './settings-labels';

export type AccountSettingsSection =
  | 'profile'
  | 'password'
  | 'sessions'
  | 'events';

type AccountSettingsPageProps = {
  section?: AccountSettingsSection;
};

export function AccountSettingsPage({
  section = 'profile'
}: AccountSettingsPageProps) {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuthSession();
  const [feedback, setFeedback] = useState<FeedbackAlertValue>(null);
  const [profileDraft, setProfileDraft] = useState({
    email: '',
    name: ''
  });
  const [passwordDraft, setPasswordDraft] = useState<ChangePasswordRequest>({
    currentPassword: '',
    nextPassword: ''
  });

  const accountQuery = useQuery({
    queryKey: accountSecurityQueryKey,
    queryFn: getAccountSecurityOverview
  });

  const profile = accountQuery.data?.profile ?? null;
  const { avatarContent, avatarKey, avatarSx, setAvatarKey } = useAccountAvatar(
    profile?.id,
    profileDraft.name || profile?.name
  );

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfileDraft({
      email: profile.email,
      name: profile.name
    });
  }, [profile]);

  const profileMutation = useMutation({
    mutationFn: () =>
      updateAccountProfile(
        {
          email: profileDraft.email,
          name: profileDraft.name
        },
        accountQuery.data!.profile
      ),
    onSuccess: async (updatedProfile) => {
      const emailChanged =
        (accountQuery.data?.profile.email ?? '') !== updatedProfile.email;
      setFeedback({
        severity: 'success',
        message: emailChanged
          ? '프로필을 저장했습니다. 새 이메일은 다시 인증해야 합니다.'
          : '프로필을 저장했습니다.'
      });
      setProfileDraft({
        email: updatedProfile.email,
        name: updatedProfile.name
      });
      await queryClient.invalidateQueries({
        queryKey: accountSecurityQueryKey
      });
      await refreshUser();
    },
    onError: (error) => {
      setFeedback(buildErrorFeedback(error, '프로필 저장에 실패했습니다.'));
    }
  });
  const resendVerificationMutation = useMutation({
    mutationFn: (email: string) => resendVerificationEmail({ email }),
    onSuccess: () => {
      setFeedback({
        severity: 'success',
        message: '인증 메일을 다시 보냈습니다. 받은 편지함을 확인해 주세요.'
      });
    },
    onError: (error) => {
      setFeedback(
        buildErrorFeedback(error, '인증 메일 재전송에 실패했습니다.')
      );
    }
  });

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(passwordDraft),
    onSuccess: async () => {
      setFeedback({
        severity: 'success',
        message: '비밀번호를 변경했고 다른 세션을 종료했습니다.'
      });
      setPasswordDraft({
        currentPassword: '',
        nextPassword: ''
      });
      await queryClient.invalidateQueries({
        queryKey: accountSecurityQueryKey
      });
    },
    onError: (error) => {
      setFeedback(buildErrorFeedback(error, '비밀번호 변경에 실패했습니다.'));
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeAccountSession(sessionId),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: '선택한 세션을 종료했습니다.' });
      await queryClient.invalidateQueries({
        queryKey: accountSecurityQueryKey
      });
    },
    onError: (error) => {
      setFeedback(buildErrorFeedback(error, '세션 종료에 실패했습니다.'));
    }
  });

  const sessionColumns = useMemo<GridColDef<AccountSessionItem>[]>(
    () => [
      {
        field: 'createdAt',
        headerName: '생성 시각',
        minWidth: 180,
        valueFormatter: (value) => formatDateTime(String(value))
      },
      {
        field: 'expiresAt',
        headerName: '만료 시각',
        minWidth: 180,
        valueFormatter: (value) => formatDateTime(String(value))
      },
      {
        field: 'revokedAt',
        headerName: '종료 시각',
        minWidth: 180,
        valueFormatter: (value) =>
          value ? formatDateTime(String(value)) : '활성'
      },
      {
        field: 'current',
        headerName: '현재',
        width: 110,
        valueGetter: (_value, row) =>
          row.isCurrent ? '현재 세션' : '다른 세션'
      },
      {
        field: 'actions',
        headerName: '관리',
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            disabled={
              params.row.isCurrent ||
              Boolean(params.row.revokedAt) ||
              revokeMutation.isPending
            }
            onClick={() => revokeMutation.mutate(params.row.id)}
          >
            종료
          </Button>
        )
      }
    ],
    [revokeMutation]
  );

  useDomainHelp(
    buildAccountSettingsHelp(section, {
      emailVerified: Boolean(profile?.emailVerifiedAt),
      recentEventCount: accountQuery.data?.recentEvents.length ?? 0,
      sessionCount: accountQuery.data?.sessions.length ?? 0
    })
  );

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="설정"
        title={readAccountSectionTitle(section)}
        badges={[
          {
            label: profile?.emailVerifiedAt
              ? '이메일 인증됨'
              : '이메일 인증 필요',
            color: profile?.emailVerifiedAt ? 'success' : 'warning'
          }
        ]}
        metadata={[
          {
            label: '이메일',
            value: profile?.email ?? '-'
          },
          {
            label: '활성 / 최근 세션',
            value: `${accountQuery.data?.sessions.length ?? 0}개`
          },
          {
            label: '최근 보안 이벤트',
            value: `${accountQuery.data?.recentEvents.length ?? 0}건`
          },
          {
            label: '개인 시간대',
            value: profile?.preferredTimezone ?? '-'
          }
        ]}
      />
      <FeedbackAlert feedback={feedback} />

      {accountQuery.error ? (
        <QueryErrorAlert
          title="계정 보안 정보를 불러오지 못했습니다."
          error={accountQuery.error}
        />
      ) : null}

      {section === 'profile' ? (
        <SectionCard title="기본 정보">
          <Stack spacing={appLayout.fieldGap}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Avatar sx={{ width: 64, height: 64, fontSize: '1.5rem', ...avatarSx }}>
                {avatarContent}
              </Avatar>
              <Stack spacing={1}>
                <Typography variant="subtitle2">프로필 아이콘</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {accountAvatarOptions.map((option) => (
                    <Button
                      key={option.key}
                      variant={avatarKey === option.key ? 'contained' : 'outlined'}
                      color={avatarKey === option.key ? 'primary' : 'inherit'}
                      size="small"
                      onClick={() => setAvatarKey(option.key)}
                      sx={{ textTransform: 'none' }}
                    >
                      {option.glyph ? `${option.glyph} ${option.label}` : option.label}
                    </Button>
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  아이콘 선택은 현재 브라우저에서 바로 반영됩니다.
                </Typography>
              </Stack>
            </Stack>
            <TextField
              fullWidth
              label="이메일"
              type="email"
              value={profileDraft.email}
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              helperText="로그인과 인증 메일 발송에 사용하는 이메일입니다."
            />
            <TextField
              fullWidth
              label="표시 이름 / 아이디"
              value={profileDraft.name}
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
            />
            <TextField
              fullWidth
              label="이메일 인증 시각"
              value={formatDateTime(profile?.emailVerifiedAt ?? null)}
              InputProps={{ readOnly: true }}
            />
            <TextField
              fullWidth
              label="개인 시간대"
              value={profile?.preferredTimezone ?? '-'}
              InputProps={{ readOnly: true }}
            />
            {!profile?.emailVerifiedAt && profile?.email ? (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                <Button
                  variant="outlined"
                  disabled={resendVerificationMutation.isPending}
                  onClick={() => resendVerificationMutation.mutate(profile.email)}
                >
                  {resendVerificationMutation.isPending
                    ? '인증 메일 전송 중...'
                    : '인증 메일 다시 보내기'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  이메일을 바꾼 뒤에는 다시 인증해야 다음 로그인에서도 정상 사용됩니다.
                </Typography>
              </Stack>
            ) : null}
            <div>
              <Button
                variant="contained"
                disabled={!profile || profileMutation.isPending}
                onClick={() => profileMutation.mutate()}
              >
                {profileMutation.isPending ? '저장 중...' : '프로필 저장'}
              </Button>
            </div>
          </Stack>
        </SectionCard>
      ) : null}

      {section === 'password' ? (
        <SectionCard title="비밀번호">
          <Stack spacing={appLayout.fieldGap}>
            <TextField
              fullWidth
              label="현재 비밀번호"
              type="password"
              value={passwordDraft.currentPassword}
              onChange={(event) =>
                setPasswordDraft((current) => ({
                  ...current,
                  currentPassword: event.target.value
                }))
              }
            />
            <TextField
              fullWidth
              label="새 비밀번호"
              type="password"
              value={passwordDraft.nextPassword}
              onChange={(event) =>
                setPasswordDraft((current) => ({
                  ...current,
                  nextPassword: event.target.value
                }))
              }
            />
            <div>
              <Button
                variant="contained"
                disabled={passwordMutation.isPending}
                onClick={() => passwordMutation.mutate()}
              >
                {passwordMutation.isPending ? '변경 중...' : '비밀번호 변경'}
              </Button>
            </div>
          </Stack>
        </SectionCard>
      ) : null}

      {section === 'sessions' ? (
        <DataTableCard
          title="세션"
          rows={accountQuery.data?.sessions ?? []}
          columns={sessionColumns}
          height={420}
        />
      ) : null}

      {section === 'events' ? (
        <SectionCard title="보안 이벤트">
          <Stack spacing={1.5}>
            {(accountQuery.data?.recentEvents ?? []).map((event) => (
              <Stack key={event.id} spacing={0.25}>
                <Typography variant="body2">
                  {readAccountSecurityEventLabel(event.kind)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(event.occurredAt)}
                </Typography>
              </Stack>
            ))}
            {(accountQuery.data?.recentEvents ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                표시할 보안 이벤트가 없습니다.
              </Typography>
            ) : null}
          </Stack>
        </SectionCard>
      ) : null}
    </Stack>
  );
}

function readAccountSectionTitle(section: AccountSettingsSection) {
  switch (section) {
    case 'password':
      return '비밀번호';
    case 'sessions':
      return '세션';
    case 'events':
      return '보안 이벤트';
    case 'profile':
    default:
      return '기본 정보';
  }
}

function buildAccountSettingsHelp(
  section: AccountSettingsSection,
  input: {
    emailVerified: boolean;
    recentEventCount: number;
    sessionCount: number;
  }
) {
  const currentHref =
    section === 'profile'
      ? '/settings/account/profile'
      : section === 'password'
        ? '/settings/account/password'
        : section === 'sessions'
          ? '/settings/account/sessions'
          : '/settings/account/events';
  const commonLinks = [
    {
      title: '기본 정보',
      description:
        '이메일, 표시 이름, 프로필 아이콘, 이메일 인증 상태 같은 계정 기본값을 관리합니다.',
      href: '/settings/account/profile',
      actionLabel: '기본 정보 보기'
    },
    {
      title: '비밀번호',
      description: '현재 비밀번호를 확인하고 새 비밀번호로 변경합니다.',
      href: '/settings/account/password',
      actionLabel: '비밀번호 보기'
    },
    {
      title: '세션',
      description: '현재 로그인 세션과 다른 기기 연결 상태를 관리합니다.',
      href: '/settings/account/sessions',
      actionLabel: '세션 보기'
    },
    {
      title: '보안 이벤트',
      description: '최근 보안 관련 이력과 계정 활동 흔적을 확인합니다.',
      href: '/settings/account/events',
      actionLabel: '보안 이벤트 보기'
    }
  ].filter((link) => link.href !== currentHref);

  switch (section) {
    case 'password':
      return {
        title: '비밀번호 도움말',
        description:
          '이 화면은 현재 계정의 비밀번호를 바꾸고 다른 세션을 정리하는 보안 작업 화면입니다.',
        primaryEntity: '비밀번호 변경',
        relatedEntities: ['AuthSession', 'SecurityEvent'],
        truthSource:
          '비밀번호 변경 결과와 세션 종료는 인증 서비스의 실제 보안 상태를 기준으로 반영됩니다.',
        supplementarySections: [
          {
            title: '이 화면에서 하는 일',
            items: [
              '현재 비밀번호와 새 비밀번호를 입력해 보안 자격 증명을 갱신합니다.',
              '비밀번호를 바꾸면 다른 세션이 함께 정리될 수 있으니 필요한 작업을 먼저 마무리합니다.',
              '변경 후에는 세션 화면과 보안 이벤트 화면에서 반영 상태를 바로 확인합니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '비밀번호 변경은 현재 로그인 세션을 제외한 다른 연결에 영향을 줄 수 있습니다. 공유 기기 사용 이력이 있으면 세션 화면도 함께 확인해 주세요.'
      };
    case 'sessions':
      return {
        title: '세션 도움말',
        description:
          '이 화면은 현재 계정으로 열려 있는 로그인 세션을 확인하고 불필요한 연결을 종료하는 화면입니다.',
        primaryEntity: '로그인 세션',
        relatedEntities: ['User', 'RefreshSession', 'SecurityEvent'],
        truthSource:
          '세션 목록은 인증 서비스가 발급한 실제 연결 상태를 기준으로 표시됩니다.',
        supplementarySections: [
          {
            title: '현재 확인 기준',
            facts: [
              {
                label: '활성 / 최근 세션',
                value: `${input.sessionCount}개`
              },
              {
                label: '이메일 인증 상태',
                value: input.emailVerified ? '인증됨' : '인증 필요'
              }
            ]
          },
          {
            title: '이 화면에서 하는 일',
            items: [
              '현재 세션과 다른 세션을 구분해 보고, 낯선 연결이 있는지 확인합니다.',
              '불필요하거나 의심스러운 세션은 종료 버튼으로 정리합니다.',
              '최근 보안 이력까지 확인하려면 보안 이벤트 화면으로 이어서 확인합니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '현재 사용 중인 세션은 여기서 종료하지 않습니다. 보안 이슈가 의심되면 비밀번호 변경 화면과 보안 이벤트 확인을 함께 진행하는 편이 안전합니다.'
      };
    case 'events':
      return {
        title: '보안 이벤트 도움말',
        description:
          '이 화면은 최근 계정 보안 이력과 인증 관련 이벤트를 시간순으로 확인하는 화면입니다.',
        primaryEntity: '보안 이벤트',
        relatedEntities: ['User', 'AuthSession'],
        truthSource:
          '보안 이벤트는 인증 서비스가 남긴 실제 활동 이력을 기준으로 표시됩니다.',
        supplementarySections: [
          {
            title: '현재 확인 기준',
            facts: [
              {
                label: '최근 보안 이벤트',
                value: `${input.recentEventCount}건`
              },
              {
                label: '이메일 인증 상태',
                value: input.emailVerified ? '인증됨' : '인증 필요'
              }
            ]
          },
          {
            title: '이 화면에서 하는 일',
            items: [
              '비밀번호 변경, 세션 종료 같은 최근 보안 이벤트가 예상대로 기록됐는지 확인합니다.',
              '예상하지 못한 활동 흔적이 보이면 세션 종료 또는 비밀번호 변경으로 바로 대응합니다.',
              '필요하면 기본 정보 화면과 세션 화면을 함께 확인해 현재 계정 상태를 다시 점검합니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '보안 이벤트는 기록 확인용입니다. 실제 조치는 비밀번호 변경 화면이나 세션 종료 화면에서 진행합니다.'
      };
    case 'profile':
    default:
      return {
        title: '기본 정보 도움말',
        description:
          '이 화면은 내 계정 이메일, 표시 이름, 프로필 아이콘, 이메일 인증 상태를 확인하고 수정하는 화면입니다.',
        primaryEntity: '계정 기본 정보',
        relatedEntities: ['AuthSession', 'SecurityEvent'],
        truthSource:
          '현재 계정 정보와 인증 상태는 로그인 사용자 기준의 실제 계정 데이터를 따릅니다.',
        supplementarySections: [
          {
            title: '현재 확인 기준',
            facts: [
              {
                label: '이메일 인증 상태',
                value: input.emailVerified ? '인증됨' : '인증 필요'
              },
              {
                label: '활성 / 최근 세션',
                value: `${input.sessionCount}개`
              }
            ]
          },
          {
            title: '이 화면에서 하는 일',
            items: [
              '로그인 이메일과 표시 이름을 현재 사용 기준에 맞게 수정합니다.',
              '프로필 아이콘을 골라 상단 사용자 영역에서도 바로 구분되게 맞춥니다.',
              '이메일 인증 상태를 확인하고 필요하면 인증 메일을 다시 보냅니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '이 화면은 계정 기본값을 보는 곳입니다. 접속 흔적이나 보안 이슈 확인은 세션 화면과 보안 이벤트 화면에서 진행합니다.'
      };
  }
}
