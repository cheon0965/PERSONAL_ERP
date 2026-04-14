'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { AccountSessionItem, ChangePasswordRequest } from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { formatDateTime } from '@/shared/lib/format';
import {
  accountSecurityQueryKey,
  changePassword,
  getAccountSecurityOverview,
  revokeAccountSession,
  updateAccountProfile
} from './settings.api';
import { readAccountSecurityEventLabel } from './settings-labels';
import { SettingsSectionNav } from './settings-section-nav';

export function AccountSettingsPage() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuthSession();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState<ChangePasswordRequest>({
    currentPassword: '',
    nextPassword: ''
  });

  const accountQuery = useQuery({
    queryKey: accountSecurityQueryKey,
    queryFn: getAccountSecurityOverview
  });

  const profileMutation = useMutation({
    mutationFn: () =>
      updateAccountProfile(
        { name: nameDraft || accountQuery.data?.profile.name || '' },
        accountQuery.data!.profile
      ),
    onSuccess: async () => {
      setFeedback('계정 이름을 저장했습니다.');
      setNameDraft('');
      await queryClient.invalidateQueries({
        queryKey: accountSecurityQueryKey
      });
      await refreshUser();
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : '계정 이름 저장에 실패했습니다.'
      );
    }
  });

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(passwordDraft),
    onSuccess: async () => {
      setFeedback('비밀번호를 변경했고 다른 세션은 종료했습니다.');
      setPasswordDraft({
        currentPassword: '',
        nextPassword: ''
      });
      await queryClient.invalidateQueries({
        queryKey: accountSecurityQueryKey
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.'
      );
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeAccountSession(sessionId),
    onSuccess: async () => {
      setFeedback('선택한 세션을 종료했습니다.');
      await queryClient.invalidateQueries({
        queryKey: accountSecurityQueryKey
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : '세션 종료에 실패했습니다.'
      );
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
        valueGetter: (_value, row) => (row.isCurrent ? '현재 세션' : '다른 세션')
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

  const profile = accountQuery.data?.profile ?? null;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="설정"
        title="내 계정 / 보안"
        description="현재 로그인 사용자의 이름, 세션, 비밀번호를 직접 관리합니다."
      />

      <SettingsSectionNav />

      {feedback ? <Alert variant="outlined">{feedback}</Alert> : null}

      {accountQuery.error ? (
        <QueryErrorAlert
          title="계정 보안 정보를 불러오지 못했습니다."
          error={accountQuery.error}
        />
      ) : null}

      <SectionCard
        title="기본 정보"
        description="이름은 운영 메모와 일부 로그 주체 표시에 함께 사용됩니다."
      >
        <Stack spacing={appLayout.fieldGap}>
          <TextField
            label="이메일"
            value={profile?.email ?? '-'}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="이름"
            value={nameDraft || profile?.name || ''}
            onChange={(event) => setNameDraft(event.target.value)}
          />
          <TextField
            label="이메일 인증 시각"
            value={formatDateTime(profile?.emailVerifiedAt ?? null)}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="개인 시간대"
            value={profile?.preferredTimezone ?? '-'}
            InputProps={{ readOnly: true }}
          />
          <Button
            variant="contained"
            disabled={!profile || profileMutation.isPending}
            onClick={() => profileMutation.mutate()}
          >
            {profileMutation.isPending ? '저장 중...' : '이름 저장'}
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard
        title="비밀번호 변경"
        description="비밀번호를 변경하면 현재 세션을 제외한 다른 활성 세션을 함께 종료합니다."
      >
        <Stack spacing={appLayout.fieldGap}>
          <TextField
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
          <Button
            variant="contained"
            disabled={passwordMutation.isPending}
            onClick={() => passwordMutation.mutate()}
          >
            {passwordMutation.isPending ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </Stack>
      </SectionCard>

      <DataTableCard
        title="활성 및 최근 세션"
        description="현재 세션은 여기서 종료하지 않고, 다른 세션만 강제 종료합니다."
        rows={accountQuery.data?.sessions ?? []}
        columns={sessionColumns}
        height={420}
      />

      <SectionCard
        title="최근 보안 이벤트"
        description="최근 로그인 세션 생성과 계정 보안 변경 이력을 함께 보여줍니다."
      >
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
              아직 표시할 보안 이벤트가 없습니다.
            </Typography>
          ) : null}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
