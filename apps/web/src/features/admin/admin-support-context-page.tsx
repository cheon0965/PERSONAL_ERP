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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import { useAuthSession } from '@/shared/auth/auth-provider';
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
  adminSupportContextQueryKey,
  adminTenantsQueryKey,
  clearAdminSupportContext,
  getAdminSupportContext,
  getAdminTenant,
  getAdminTenants,
  updateAdminSupportContext
} from './admin.api';

export function AdminSupportContextPage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuthSession();
  const canUse = user?.isSystemAdmin === true;
  const [tenantId, setTenantId] = useState('');
  const [ledgerId, setLedgerId] = useState('');
  const [feedback, setFeedback] = useState<FeedbackAlertValue>(null);

  const tenantsQuery = useQuery({
    queryKey: adminTenantsQueryKey,
    queryFn: getAdminTenants,
    enabled: canUse
  });
  const supportContextQuery = useQuery({
    queryKey: adminSupportContextQueryKey,
    queryFn: getAdminSupportContext,
    enabled: canUse
  });
  const tenantDetailQuery = useQuery({
    queryKey: [...adminTenantsQueryKey, tenantId],
    queryFn: () => getAdminTenant(tenantId),
    enabled: canUse && Boolean(tenantId)
  });

  useEffect(() => {
    const context = supportContextQuery.data;
    if (!context?.tenant?.id || tenantId) {
      return;
    }

    setTenantId(context.tenant.id);
    setLedgerId(context.ledger?.id ?? '');
  }, [supportContextQuery.data, tenantId]);

  const startMutation = useMutation({
    mutationFn: () =>
      updateAdminSupportContext({
        tenantId,
        ...(ledgerId ? { ledgerId } : {})
      }),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: '지원 모드를 시작했습니다.' });
      await queryClient.invalidateQueries({
        queryKey: adminSupportContextQueryKey
      });
      await refreshUser();
    },
    onError: (error) => {
      setFeedback(buildErrorFeedback(error, '지원 모드를 시작하지 못했습니다.'));
    }
  });
  const clearMutation = useMutation({
    mutationFn: clearAdminSupportContext,
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: '지원 모드를 해제했습니다.' });
      setTenantId('');
      setLedgerId('');
      await queryClient.invalidateQueries({
        queryKey: adminSupportContextQueryKey
      });
      await refreshUser();
    },
    onError: (error) => {
      setFeedback(buildErrorFeedback(error, '지원 모드를 해제하지 못했습니다.'));
    }
  });

  useDomainHelp({
    title: '사업장 전환 / 지원 모드 가이드',
    description:
      '지원 모드는 전체 관리자가 다른 사용자로 가장하지 않고, SYSTEM_ADMIN 권한으로 특정 사업장과 장부 문맥을 선택해 운영 화면을 확인하는 기능입니다.',
    primaryEntity: '지원 문맥',
    relatedEntities: ['사업장', '장부', '감사 로그'],
    truthSource:
      '지원 모드는 현재 로그인 세션에만 저장되며, 모든 작업은 실제 전체 관리자 사용자 ID로 기록됩니다.',
    supplementarySections: [
      {
        title: '확인 기준',
        items: [
          '현재 지원 문맥이 켜져 있는지 먼저 확인하고, 필요 없으면 해제합니다.',
          '사업장과 장부를 명시적으로 선택한 뒤 운영 메뉴를 확인합니다.',
          '지원 모드에서는 다른 사용자로 가장하지 않고 전체 관리자 권한으로 동작합니다.',
          '운영 화면에서 점검할 항목을 처리한 뒤 작업이 끝나면 지원 모드를 해제해 일반 전체 관리자 문맥으로 돌아갑니다.'
        ]
      },
      {
        title: '후속 안내',
        links: [
          {
            title: '사업장 관리',
            href: '/admin/tenants',
            description: '지원 문맥으로 열 사업장의 상태와 기본 장부를 확인합니다.',
            actionLabel: '사업장 관리 열기'
          },
          {
            title: '운영 기간',
            href: '/periods',
            description:
              '선택한 사업장 문맥에서 열린 운영 월과 마감 상태를 확인합니다.',
            actionLabel: '운영 기간 열기'
          },
          {
            title: '감사 로그',
            href: '/admin/logs',
            description:
              '지원 모드 설정과 이후 작업이 실제 전체 관리자 ID로 기록됐는지 확인합니다.',
            actionLabel: '감사 로그 열기'
          }
        ]
      }
    ]
  });

  const supportContext = supportContextQuery.data;
  const ledgers = tenantDetailQuery.data?.ledgers ?? [];

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="전체 관리자"
        title="사업장 전환 / 지원 모드"
        badges={[
          {
            label: supportContext?.enabled ? '지원 모드 사용 중' : '대기',
            color: supportContext?.enabled ? 'success' : 'default'
          },
          {
            label: canUse ? '전체 관리자 전용' : '권한 없음',
            color: canUse ? 'primary' : 'warning'
          }
        ]}
      />
      {!canUse ? (
        <Alert severity="warning" variant="outlined">
          지원 모드는 전체 관리자만 사용할 수 있습니다.
        </Alert>
      ) : null}
      <FeedbackAlert feedback={feedback} />
      {supportContextQuery.error ? (
        <QueryErrorAlert
          title="지원 문맥을 불러오지 못했습니다."
          error={supportContextQuery.error}
        />
      ) : null}

      <SectionCard
        title="현재 지원 문맥"
        description="현재 세션에 저장된 사업장과 장부 문맥입니다."
      >
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Info label="상태" value={supportContext?.enabled ? '사용 중' : '꺼짐'} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Info label="사업장" value={supportContext?.tenant?.name ?? '-'} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Info label="장부" value={supportContext?.ledger?.name ?? '-'} />
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title="지원 문맥 선택"
        description="문제를 재현하거나 운영 상태를 확인할 사업장과 장부를 선택합니다."
      >
        <Stack spacing={2}>
          <TextField
            select
            label="사업장"
            value={tenantId}
            onChange={(event) => {
              setTenantId(event.target.value);
              setLedgerId('');
            }}
          >
            {(tenantsQuery.data ?? []).map((tenant) => (
              <MenuItem key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.slug})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="장부"
            value={ledgerId}
            onChange={(event) => setLedgerId(event.target.value)}
            disabled={!tenantId}
          >
            <MenuItem value="">기본 장부 자동 선택</MenuItem>
            {ledgers.map((ledger) => (
              <MenuItem key={ledger.id} value={ledger.id}>
                {ledger.name} ({ledger.baseCurrency} / {ledger.timezone})
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              disabled={!tenantId || startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              지원 모드 시작
            </Button>
            <Button
              variant="outlined"
              color="warning"
              disabled={!supportContext?.enabled || clearMutation.isPending}
              onClick={() => clearMutation.mutate()}
            >
              지원 모드 해제
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.4}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
    </Stack>
  );
}
