'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { UpdateWorkspaceSettingsRequest } from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  workspaceSettingsQueryKey
} from './settings.api';
import {
  readLedgerStatusLabel,
  readTenantStatusLabel
} from './settings-labels';
import { SettingsSectionNav } from './settings-section-nav';

const editableStatuses = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;

export function WorkspaceSettingsPage() {
  const queryClient = useQueryClient();
  const { refreshUser, user } = useAuthSession();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateWorkspaceSettingsRequest>({
    tenantName: '',
    tenantSlug: '',
    tenantStatus: 'ACTIVE',
    ledgerName: '',
    baseCurrency: 'KRW',
    timezone: 'Asia/Seoul'
  });

  const workspaceQuery = useQuery({
    queryKey: workspaceSettingsQueryKey,
    queryFn: getWorkspaceSettings
  });

  useEffect(() => {
    if (!workspaceQuery.data) {
      return;
    }

    setForm({
      tenantName: workspaceQuery.data.tenant.name,
      tenantSlug: workspaceQuery.data.tenant.slug,
      tenantStatus: workspaceQuery.data.tenant.status,
      ledgerName: workspaceQuery.data.ledger.name,
      baseCurrency: workspaceQuery.data.ledger.baseCurrency,
      timezone: workspaceQuery.data.ledger.timezone
    });
  }, [workspaceQuery.data]);

  const canManage = workspaceQuery.data?.canManage ?? false;
  const mutation = useMutation({
    mutationFn: (input: UpdateWorkspaceSettingsRequest) =>
      updateWorkspaceSettings(input, workspaceQuery.data!),
    onSuccess: async () => {
      setFeedback('사업장 설정을 저장했습니다.');
      await queryClient.invalidateQueries({
        queryKey: workspaceSettingsQueryKey
      });
      await refreshUser();
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error
          ? error.message
          : '사업장 설정 저장에 실패했습니다.'
      );
    }
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="설정"
        title="사업장 설정"
        description="현재 사업장의 이름, 슬러그, 상태와 기본 장부 기준값을 관리합니다."
      />

      <SettingsSectionNav />

      {feedback ? <Alert variant="outlined">{feedback}</Alert> : null}

      {!canManage ? (
        <Alert severity="warning" variant="outlined">
          현재 역할은 {user?.currentWorkspace?.membership.role ?? '-'} 입니다. 사업장
          설정 수정은 소유자 또는 관리자만 수행할 수 있습니다.
        </Alert>
      ) : null}

      {workspaceQuery.error ? (
        <QueryErrorAlert
          title="사업장 설정을 불러오지 못했습니다."
          error={workspaceQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="사업장과 기본 장부"
            description="현재 기본 장부 1개 전제를 유지하면서 운영 기준값만 조정합니다."
          >
            <Stack spacing={appLayout.fieldGap}>
              <TextField
                label="사업장 이름"
                value={form.tenantName}
                disabled={!canManage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tenantName: event.target.value
                  }))
                }
              />
              <TextField
                label="사업장 슬러그"
                value={form.tenantSlug}
                disabled={!canManage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tenantSlug: event.target.value
                  }))
                }
                helperText="소문자, 숫자, 하이픈만 사용합니다."
              />
              <TextField
                select
                label="사업장 상태"
                value={form.tenantStatus}
                disabled={!canManage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tenantStatus:
                      event.target.value as UpdateWorkspaceSettingsRequest['tenantStatus']
                  }))
                }
              >
                {editableStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {readTenantStatusLabel(status)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="기본 장부 이름"
                value={form.ledgerName}
                disabled={!canManage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ledgerName: event.target.value
                  }))
                }
              />
              <TextField
                label="기준 통화"
                value={form.baseCurrency}
                disabled={!canManage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    baseCurrency: event.target.value.toUpperCase()
                  }))
                }
              />
              <TextField
                label="시간대"
                value={form.timezone}
                disabled={!canManage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    timezone: event.target.value
                  }))
                }
              />
              <Button
                variant="contained"
                disabled={!canManage || mutation.isPending || !workspaceQuery.data}
                onClick={() => mutation.mutate(form)}
              >
                {mutation.isPending ? '저장 중...' : '설정 저장'}
              </Button>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="현재 운영 기준"
            description="실제 저장 값과 마감 범위를 한 번 더 확인합니다."
          >
            <Stack spacing={1.5}>
              <Detail
                label="현재 사업장 상태"
                value={readTenantStatusLabel(workspaceQuery.data?.tenant.status ?? null)}
              />
              <Detail
                label="현재 장부 상태"
                value={readLedgerStatusLabel(workspaceQuery.data?.ledger.status ?? null)}
              />
              <Detail
                label="열린 시작 월"
                value={workspaceQuery.data?.ledger.openedFromYearMonth ?? '-'}
              />
              <Detail
                label="마감 완료 월"
                value={workspaceQuery.data?.ledger.closedThroughYearMonth ?? '-'}
              />
              <Typography variant="body2" color="text.secondary">
                상태와 기준 통화, 시간대 변경은 이후 월 운영/재무제표 기준에
                직접 영향을 줍니다. 저장 전 현재 운영 범위를 다시 확인해 주세요.
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}
