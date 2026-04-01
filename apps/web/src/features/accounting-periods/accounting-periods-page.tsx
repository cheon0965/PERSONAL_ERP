'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import { Alert, Grid, Stack } from '@mui/material';
import type {
  AccountingPeriodItem,
  CloseAccountingPeriodResponse,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { getTodayMonthInputValue } from '@/shared/lib/date-input';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  accountingPeriodsQueryKey,
  buildCloseAccountingPeriodFallback,
  buildReopenAccountingPeriodFallback,
  closeAccountingPeriod,
  currentAccountingPeriodQueryKey,
  getAccountingPeriods,
  openAccountingPeriod,
  reopenAccountingPeriod
} from './accounting-periods.api';
import {
  CurrentPeriodStatusSection,
  LatestClosingSnapshotSection,
  OpenAccountingPeriodSection,
  PeriodLifecycleActionsSection,
  periodColumns
} from './accounting-periods-page.sections';
import {
  periodFormSchema,
  type PeriodFormInput,
  type ReopenAccountingPeriodPayload,
  type SubmitFeedback
} from './accounting-periods-page.types';

export function AccountingPeriodsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [closeNote, setCloseNote] = React.useState('');
  const [reopenReason, setReopenReason] = React.useState('');
  const [latestClosingResult, setLatestClosingResult] =
    React.useState<CloseAccountingPeriodResponse | null>(null);
  const { data: periods = [], error } = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });
  const currentWorkspace = user?.currentWorkspace ?? null;
  const membershipRole = currentWorkspace?.membership.role ?? null;

  useDomainHelp({
    title: '운영 기간 관리 개요',
    description:
      '운영 기간은 모든 수집 거래, 전표 확정, 마감, 재무제표의 기준 월을 고정합니다. 월 운영 시작부터 잠금, 재오픈까지의 상태 흐름을 이 화면에서 관리합니다.',
    primaryEntity: '운영 기간 (AccountingPeriod)',
    relatedEntities: [
      '기간 상태 이력 (PeriodStatusHistory)',
      '오프닝 잔액 스냅샷 (OpeningBalanceSnapshot)',
      '장부 (Ledger)',
      '테넌트 멤버십 (TenantMembership)'
    ],
    truthSource:
      '운영 월의 공식 시작 기준은 AccountingPeriod이며, 첫 월 시작은 OpeningBalanceSnapshot 생성 여부까지 함께 남깁니다.',
    supplementarySections: [
      {
        title: '현재 작업 문맥',
        description:
          '월 운영 시작과 마감은 현재 로그인한 사용자의 TenantMembership / Ledger 문맥 안에서만 실행됩니다.',
        facts: [
          {
            label: 'Tenant',
            value: currentWorkspace
              ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
              : '-'
          },
          {
            label: 'Ledger',
            value: currentWorkspace?.ledger?.name ?? '-'
          },
          {
            label: '권한',
            value: membershipRole ?? '-'
          },
          {
            label: '기준 통화 / 시간대',
            value: currentWorkspace?.ledger
              ? `${currentWorkspace.ledger.baseCurrency} / ${currentWorkspace.ledger.timezone}`
              : '-'
          }
        ]
      }
    ],
    readModelNote:
      '현재 목록은 운영 기간 상태와 최근 마감 결과를 함께 확인하는 관리 화면입니다.'
  });

  const form = useForm<PeriodFormInput>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: {
      month: getTodayMonthInputValue(),
      initializeOpeningBalance: true,
      note: ''
    }
  });

  const hasWorkspace = Boolean(currentWorkspace?.ledger);
  const canOpenPeriod =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const canClosePeriod = membershipRole === 'OWNER';
  const canReopenPeriod = membershipRole === 'OWNER';
  const isFirstPeriod = periods.length === 0;
  const openPeriod = React.useMemo(
    () => periods.find((period) => period.status !== 'LOCKED') ?? null,
    [periods]
  );
  const latestPeriod = periods[0] ?? null;
  const reopenPeriod = latestPeriod?.status === 'LOCKED' ? latestPeriod : null;
  const currentPeriod = openPeriod ?? latestPeriod ?? null;

  React.useEffect(() => {
    form.setValue('initializeOpeningBalance', isFirstPeriod, {
      shouldValidate: false
    });
  }, [form, isFirstPeriod]);

  const openMutation = useMutation({
    mutationFn: (payload: OpenAccountingPeriodRequest) =>
      openAccountingPeriod(payload),
    onSuccess: async () => {
      await invalidateAccountingPeriodQueries(queryClient);
    }
  });

  const closeMutation = useMutation({
    mutationFn: (period: AccountingPeriodItem) =>
      closeAccountingPeriod(
        period.id,
        { note: closeNote.trim() || undefined },
        buildCloseAccountingPeriodFallback(period, {
          note: closeNote.trim() || undefined
        })
      ),
    onSuccess: async (result) => {
      setLatestClosingResult(result);
      await invalidateAccountingPeriodQueries(queryClient);
    }
  });

  const reopenMutation = useMutation({
    mutationFn: (payload: ReopenAccountingPeriodPayload) =>
      reopenAccountingPeriod(
        payload.period.id,
        payload.input,
        buildReopenAccountingPeriodFallback(payload.period, payload.input)
      ),
    onSuccess: async () => {
      setLatestClosingResult(null);
      await invalidateAccountingPeriodQueries(queryClient);
    }
  });

  const initializeOpeningBalance = form.watch('initializeOpeningBalance');
  const openFormBusy =
    openMutation.isPending || form.formState.isSubmitting || !hasWorkspace;

  const handleOpenPeriodSubmit = form.handleSubmit(async (values) => {
    setFeedback(null);

    try {
      await openMutation.mutateAsync({
        month: values.month,
        initializeOpeningBalance: values.initializeOpeningBalance,
        note: values.note.trim() || undefined
      });

      setFeedback({
        severity: 'success',
        message: `${values.month} 운영 기간을 시작했습니다.`
      });
    } catch (mutationError) {
      setFeedback({
        severity: 'error',
        message:
          mutationError instanceof Error
            ? mutationError.message
            : '운영 기간을 시작하지 못했습니다.'
      });
    }
  });

  const handleClosePeriod = React.useCallback(async () => {
    if (!openPeriod) {
      return;
    }

    setFeedback(null);

    try {
      const result = await closeMutation.mutateAsync(openPeriod);
      setFeedback({
        severity: 'success',
        message: `${result.period.monthLabel} 월 마감을 완료했습니다.`
      });
    } catch (mutationError) {
      setFeedback({
        severity: 'error',
        message:
          mutationError instanceof Error
            ? mutationError.message
            : '월 마감을 완료하지 못했습니다.'
      });
    }
  }, [closeMutation, openPeriod]);

  const handleReopenPeriod = React.useCallback(async () => {
    if (!reopenPeriod) {
      return;
    }

    setFeedback(null);

    try {
      const result = await reopenMutation.mutateAsync({
        period: reopenPeriod,
        input: {
          reason: reopenReason.trim()
        }
      });
      setReopenReason('');
      setFeedback({
        severity: 'success',
        message: `${result.monthLabel} 월을 재오픈했습니다.`
      });
    } catch (mutationError) {
      setFeedback({
        severity: 'error',
        message:
          mutationError instanceof Error
            ? mutationError.message
            : '월 재오픈을 완료하지 못했습니다.'
      });
    }
  }, [reopenMutation, reopenPeriod, reopenReason]);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="월 운영 시작"
        title="운영 기간 관리"
        description="현재 장부의 운영 기간을 열고, 상태를 관리하며, 최근 마감 결과를 확인합니다."
        primaryActionLabel="월 운영 시작"
        primaryActionHref="#open-accounting-period-form"
      />
      {error ? (
        <QueryErrorAlert
          title="운영 기간 목록을 불러오지 못했습니다."
          error={error}
        />
      ) : null}

      {!hasWorkspace ? (
        <Alert severity="warning" variant="outlined">
          현재 작업 Tenant 및 Ledger 문맥이 아직 준비되지 않았습니다. 작업 문맥
          화면에서 연결 상태를 먼저 확인해 주세요.
        </Alert>
      ) : null}

      {!canOpenPeriod && hasWorkspace ? (
        <Alert severity="info" variant="outlined">
          월 운영 시작은 Owner 또는 Manager만 실행할 수 있습니다. 현재 역할은{' '}
          {membershipRole} 입니다.
        </Alert>
      ) : null}

      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}

      {latestClosingResult ? (
        <Alert severity="success" variant="outlined">
          {latestClosingResult.period.monthLabel} 월 마감이 완료되었습니다.
          생성된 스냅샷 라인 {latestClosingResult.closingSnapshot.lines.length}
          건, 당기손익{' '}
          {formatWon(latestClosingResult.closingSnapshot.periodPnLAmount)}{' '}
          입니다.
        </Alert>
      ) : null}

      <CurrentPeriodStatusSection currentPeriod={currentPeriod} />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <DataTableCard
            title="운영 기간 목록"
            description="현재 Ledger에 생성된 운영 기간과 오프닝 준비 여부를 최신 월 순서로 확인합니다."
            rows={periods}
            columns={periodColumns}
            height={360}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <OpenAccountingPeriodSection
            form={form}
            initializeOpeningBalance={initializeOpeningBalance}
            isFirstPeriod={isFirstPeriod}
            isBusy={openFormBusy}
            canOpenPeriod={canOpenPeriod}
            isSubmitting={openMutation.isPending}
            onSubmit={handleOpenPeriodSubmit}
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <PeriodLifecycleActionsSection
            openPeriod={openPeriod}
            reopenPeriod={reopenPeriod}
            membershipRole={membershipRole}
            canClosePeriod={canClosePeriod}
            canReopenPeriod={canReopenPeriod}
            hasWorkspace={hasWorkspace}
            closeNote={closeNote}
            reopenReason={reopenReason}
            closePending={closeMutation.isPending}
            reopenPending={reopenMutation.isPending}
            onCloseNoteChange={setCloseNote}
            onReopenReasonChange={setReopenReason}
            onClosePeriod={handleClosePeriod}
            onReopenPeriod={handleReopenPeriod}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 7 }}>
          <LatestClosingSnapshotSection
            latestClosingResult={latestClosingResult}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}

async function invalidateAccountingPeriodQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    queryKey: accountingPeriodsQueryKey
  });
  await queryClient.invalidateQueries({
    queryKey: currentAccountingPeriodQueryKey
  });
}
