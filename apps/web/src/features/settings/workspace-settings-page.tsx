'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import type { UpdateWorkspaceSettingsRequest } from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { membershipRoleLabelMap } from '@/shared/auth/auth-labels';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  workspaceSettingsQueryKey
} from './settings.api';
import { CreateWorkspaceDialog } from './create-workspace-dialog';
import { DeleteWorkspaceDialog } from './delete-workspace-dialog';
import {
  readLedgerStatusLabel,
  readTenantStatusLabel
} from './settings-labels';
import { SettingsSectionNav } from './settings-section-nav';

const editableStatuses = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;

export function WorkspaceSettingsPage() {
  const queryClient = useQueryClient();
  const { refreshUser, user } = useAuthSession();
  const [feedback, setFeedback] = useState<FeedbackAlertValue>(null);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [deleteWorkspaceOpen, setDeleteWorkspaceOpen] = useState(false);
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
      setFeedback({
        severity: 'success',
        message: '사업장 설정을 저장했습니다.'
      });
      await queryClient.invalidateQueries({
        queryKey: workspaceSettingsQueryKey
      });
      await refreshUser();
    },
    onError: (error) => {
      setFeedback(
        buildErrorFeedback(error, '사업장 설정 저장에 실패했습니다.')
      );
    }
  });

  useDomainHelp({
    title: '사업장 설정 화면 도움말',
    description:
      '사업장 설정은 현재 사업장 이름, 상태, 기본 장부 기준값을 관리하는 화면입니다.',
    primaryEntity: '사업장 / 장부',
    relatedEntities: ['운영 기간', '재무제표 스냅샷'],
    truthSource:
      '여기서 저장한 사업장 상태, 기본 장부 이름, 통화, 시간대가 운영 월과 보고 화면의 기본 기준이 됩니다.',
    supplementarySections: [
      {
        title: '변경 전에 확인할 것',
        items: [
          '상단의 사업장, 장부 상태, 열린 시작 월, 마감 완료 월을 보고 현재 운영 중인 장부가 맞는지 확인합니다.',
          '사업장 이름과 장부 이름은 사용자가 화면에서 식별하는 기준이므로 실제 운영 명칭에 맞춰 저장합니다.',
          '통화와 시간대는 월 운영, 거래일 입력, 보고 기준에 영향을 주므로 운영 중 변경 전 팀 기준을 확인합니다.'
        ]
      },
      {
        title: '저장 후 확인',
        items: [
          '설정 저장 후 상단 사용자/사업장 표시가 새 이름으로 보이는지 확인합니다.',
          '상태를 중지 또는 보관으로 바꾼 경우 일반 운영 화면 접근이 의도대로 제한되는지 확인합니다.',
          '시간대나 통화 기준을 바꿨다면 운영 월과 보고 화면의 표시 기준을 다시 확인합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '운영 기간',
            description:
              '저장한 장부 기준으로 열린 월과 마감 완료 월이 맞는지 확인합니다.',
            href: '/periods',
            actionLabel: '운영 기간 보기'
          },
          {
            title: '기준 데이터 준비 상태',
            description:
              '사업장 설정 후 자금수단, 카테고리, 계정과목 준비 상태를 점검합니다.',
            href: '/reference-data',
            actionLabel: '기준 데이터 보기'
          },
          {
            title: '계정 기본 정보',
            description:
              '개인 이메일, 표시 이름, 인증 상태처럼 사용자 계정 기준을 별도로 관리합니다.',
            href: '/settings/account/profile',
            actionLabel: '계정 설정 보기'
          }
        ]
      }
    ]
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="설정"
        title="사업장 설정"
        description="현재 사업장의 이름, 상태와 기본 장부 기준값을 한 화면에서 관리합니다."
        badges={[
          {
            label: readTenantStatusLabel(
              workspaceQuery.data?.tenant.status ?? null
            ),
            color: canManage ? 'primary' : 'default'
          },
          {
            label: readLedgerStatusLabel(
              workspaceQuery.data?.ledger.status ?? null
            )
          }
        ]}
        metadata={[
          {
            label: '열린 시작 월',
            value: workspaceQuery.data?.ledger.openedFromYearMonth ?? '-'
          },
          {
            label: '마감 완료 월',
            value: workspaceQuery.data?.ledger.closedThroughYearMonth ?? '-'
          },
          {
            label: '기준 통화 / 시간대',
            value: `${form.baseCurrency} / ${form.timezone}`
          },
          {
            label: '수정 권한',
            value: canManage ? '있음' : '없음'
          }
        ]}
        metadataSingleRow
        primaryActionLabel="설정 저장"
        primaryActionOnClick={() => mutation.mutate(form)}
        primaryActionDisabled={
          !canManage || mutation.isPending || !workspaceQuery.data
        }
        secondaryActionLabel="사업장 추가"
        secondaryActionOnClick={() => setCreateWorkspaceOpen(true)}
      />

      <SettingsSectionNav />

      <FeedbackAlert feedback={feedback} />

      {!canManage ? (
        <Alert severity="warning" variant="outlined">
          현재 역할은{' '}
          {user?.currentWorkspace?.membership.role
            ? (membershipRoleLabelMap[user.currentWorkspace.membership.role] ??
              user.currentWorkspace.membership.role)
            : '-'}{' '}
          입니다. 사업장 설정 수정은 소유자 또는 관리자만 수행할 수 있습니다.
        </Alert>
      ) : null}

      {workspaceQuery.error ? (
        <QueryErrorAlert
          title="사업장 설정을 불러오지 못했습니다."
          error={workspaceQuery.error}
        />
      ) : null}

      <SectionCard
        title="사업장과 기본 장부"
        description="개요 카드는 줄이고, 실제 수정이 필요한 기준값을 먼저 편집합니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
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
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
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
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="사업장 상태"
                value={form.tenantStatus}
                disabled={!canManage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tenantStatus: event.target
                      .value as UpdateWorkspaceSettingsRequest['tenantStatus']
                  }))
                }
              >
                {editableStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {readTenantStatusLabel(status)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
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
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
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
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
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
            </Grid>
          </Grid>
          <div>
            <Button
              variant="contained"
              disabled={
                !canManage || mutation.isPending || !workspaceQuery.data
              }
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? '저장 중...' : '설정 저장'}
            </Button>
            <Button
              variant="outlined"
              sx={{ ml: 1 }}
              onClick={() => setCreateWorkspaceOpen(true)}
            >
              사업장 추가
            </Button>
            <Button
              variant="outlined"
              color="error"
              sx={{ ml: 1 }}
              onClick={() => setDeleteWorkspaceOpen(true)}
            >
              사업장 삭제
            </Button>
          </div>
        </Stack>
      </SectionCard>

      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
        onCreated={() =>
          setFeedback({
            severity: 'success',
            message: '새 사업장을 만들고 현재 작업 기준으로 전환했습니다.'
          })
        }
      />
      <DeleteWorkspaceDialog
        open={deleteWorkspaceOpen}
        onClose={() => setDeleteWorkspaceOpen(false)}
        onDeleted={() =>
          setFeedback({
            severity: 'success',
            message: '사업장을 삭제하고 남은 사업장으로 전환했습니다.'
          })
        }
      />
    </Stack>
  );
}
