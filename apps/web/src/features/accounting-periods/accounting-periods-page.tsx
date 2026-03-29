'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  FormControlLabel,
  Grid,
  Checkbox,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountingPeriodItem,
  CloseAccountingPeriodResponse,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { getTodayMonthInputValue } from '@/shared/lib/date-input';
import { formatDate, formatWon } from '@/shared/lib/format';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  accountingPeriodsQueryKey,
  buildCloseAccountingPeriodFallback,
  closeAccountingPeriod,
  currentAccountingPeriodQueryKey,
  getAccountingPeriods,
  openAccountingPeriod
} from './accounting-periods.api';

const periodFormSchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, '운영 월은 YYYY-MM 형식이어야 합니다.'),
  initializeOpeningBalance: z.boolean(),
  note: z.string().max(300, '메모는 300자 이하여야 합니다.')
});

type PeriodFormInput = z.infer<typeof periodFormSchema>;

type SubmitFeedback =
  | {
      severity: 'success' | 'error';
      message: string;
    }
  | null;

const periodColumns: GridColDef<AccountingPeriodItem>[] = [
  { field: 'monthLabel', headerName: '운영 월', flex: 0.8 },
  {
    field: 'status',
    headerName: '상태',
    flex: 0.7,
    renderCell: (params) => <StatusChip label={String(params.value)} />
  },
  {
    field: 'hasOpeningBalanceSnapshot',
    headerName: '오프닝',
    flex: 0.9,
    valueGetter: (_value, row) =>
      row.hasOpeningBalanceSnapshot
        ? row.openingBalanceSourceKind === 'INITIAL_SETUP'
          ? '초기 셋업'
          : '이월'
        : '미생성'
  },
  {
    field: 'openedAt',
    headerName: '시작일',
    flex: 1,
    valueFormatter: (value) => formatDate(String(value))
  },
  {
    field: 'lockedAt',
    headerName: '잠금일',
    flex: 1,
    valueFormatter: (value) =>
      value ? formatDate(String(value)) : '-'
  }
];

export function AccountingPeriodsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [closeNote, setCloseNote] = React.useState('');
  const [latestClosingResult, setLatestClosingResult] =
    React.useState<CloseAccountingPeriodResponse | null>(null);
  const { data: periods = [], error } = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });

  useDomainHelp({
    title: '운영 기간 관리 개요',
    description:
      '운영 기간은 모든 수집 거래, 전표 확정, 마감, 재무제표의 기준 월을 고정합니다. 이 라운드에서는 월 운영 시작과 상태 이력의 최소 경로를 먼저 연결합니다.',
    primaryEntity: '운영 기간 (AccountingPeriod)',
    relatedEntities: [
      '기간 상태 이력 (PeriodStatusHistory)',
      '오프닝 잔액 스냅샷 (OpeningBalanceSnapshot)',
      '장부 (Ledger)',
      '테넌트 멤버십 (TenantMembership)'
    ],
    truthSource:
      '운영 월의 공식 시작 기준은 AccountingPeriod이며, 첫 월 시작은 OpeningBalanceSnapshot 생성 여부까지 함께 남깁니다.',
    readModelNote:
      '현재 목록은 기간 운영 상태를 빠르게 확인하는 읽기 모델이며, 이후 라운드에서 마감과 이월 흐름이 여기에 이어집니다.'
  });

  const form = useForm<PeriodFormInput>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: {
      month: getTodayMonthInputValue(),
      initializeOpeningBalance: true,
      note: ''
    }
  });

  const currentWorkspace = user?.currentWorkspace ?? null;
  const membershipRole = currentWorkspace?.membership.role ?? null;
  const hasWorkspace = Boolean(currentWorkspace?.ledger);
  const canOpenPeriod =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const canClosePeriod = membershipRole === 'OWNER';
  const isFirstPeriod = periods.length === 0;
  const openPeriod = React.useMemo(
    () => periods.find((period) => period.status !== 'LOCKED') ?? null,
    [periods]
  );
  const currentPeriod = openPeriod ?? periods[0] ?? null;

  React.useEffect(() => {
    form.setValue('initializeOpeningBalance', isFirstPeriod, {
      shouldValidate: false
    });
  }, [form, isFirstPeriod]);

  const mutation = useMutation({
    mutationFn: (payload: OpenAccountingPeriodRequest) => openAccountingPeriod(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accountingPeriodsQueryKey
      });
      await queryClient.invalidateQueries({
        queryKey: currentAccountingPeriodQueryKey
      });
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
      await queryClient.invalidateQueries({
        queryKey: accountingPeriodsQueryKey
      });
      await queryClient.invalidateQueries({
        queryKey: currentAccountingPeriodQueryKey
      });
    }
  });

  const isBusy = mutation.isPending || form.formState.isSubmitting || !hasWorkspace;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="월 운영 시작"
        title="운영 기간 관리"
        description="이 화면은 Ledger 안에서 AccountingPeriod를 열고, 첫 월에는 OpeningBalanceSnapshot을 함께 준비하는 운영 시작 화면입니다."
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
          현재 작업 Tenant 및 Ledger 문맥이 아직 준비되지 않았습니다. 설정 화면에서
          작업 문맥을 먼저 확인해 주세요.
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
          {' '}
          생성된 스냅샷 라인 {latestClosingResult.closingSnapshot.lines.length}건,
          당기손익 {formatWon(latestClosingResult.closingSnapshot.periodPnLAmount)}입니다.
        </Alert>
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <SectionCard
            title="현재 작업 문맥"
            description="월 운영 시작은 현재 로그인한 사용자의 TenantMembership / Ledger 문맥 안에서만 실행됩니다."
          >
            <Stack spacing={1.25}>
              <InfoRow
                label="Tenant"
                value={
                  currentWorkspace
                    ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
                    : '-'
                }
              />
              <InfoRow
                label="Ledger"
                value={currentWorkspace?.ledger?.name ?? '-'}
              />
              <InfoRow
                label="역할"
                value={membershipRole ?? '-'}
              />
              <InfoRow
                label="기준 통화 / 시간대"
                value={
                  currentWorkspace?.ledger
                    ? `${currentWorkspace.ledger.baseCurrency} / ${currentWorkspace.ledger.timezone}`
                    : '-'
                }
              />
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, xl: 7 }}>
          <SectionCard
            title="현재 기간 상태"
            description="가장 최근 운영 기간 또는 현재 열린 기간의 상태를 빠르게 확인합니다."
          >
            {currentPeriod ? (
              <Stack spacing={1.5}>
                <Grid container spacing={appLayout.fieldGap}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <InfoRow label="운영 월" value={currentPeriod.monthLabel} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <InfoRow
                      label="상태"
                      value={<StatusChip label={currentPeriod.status} />}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <InfoRow
                      label="오프닝 스냅샷"
                      value={
                        currentPeriod.hasOpeningBalanceSnapshot
                          ? currentPeriod.openingBalanceSourceKind === 'INITIAL_SETUP'
                            ? '초기 셋업'
                            : '이월'
                          : '미생성'
                      }
                    />
                  </Grid>
                </Grid>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">최근 상태 이력</Typography>
                  {currentPeriod.statusHistory.length > 0 ? (
                    currentPeriod.statusHistory.slice(0, 3).map((history) => (
                      <Typography
                        key={history.id}
                        variant="body2"
                        color="text.secondary"
                      >
                        {formatDate(history.changedAt)} ·{' '}
                        {history.fromStatus ? `${history.fromStatus} -> ` : ''}
                        {history.toStatus}
                        {history.reason ? ` · ${history.reason}` : ''}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      아직 기록된 상태 이력이 없습니다.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                아직 시작된 운영 기간이 없습니다. 첫 월 운영 시작을 진행해 주세요.
              </Typography>
            )}
          </SectionCard>
        </Grid>
      </Grid>

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
          <div id="open-accounting-period-form">
            <SectionCard
              title="월 운영 시작"
              description="첫 월은 오프닝 잔액 스냅샷을 함께 생성하고, 이후 월은 이전 기간 잠금 이후에만 열 수 있습니다."
            >
              <form
                onSubmit={form.handleSubmit(async (values) => {
                  setFeedback(null);

                  try {
                    await mutation.mutateAsync({
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
                })}
              >
                <Stack spacing={appLayout.cardGap}>
                  <TextField
                    label="운영 월"
                    type="month"
                    error={Boolean(form.formState.errors.month)}
                    helperText={
                      form.formState.errors.month?.message ??
                      '현재 Ledger에 대해 열 운영 월을 선택합니다.'
                    }
                    {...form.register('month')}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.watch('initializeOpeningBalance')}
                        onChange={(event) => {
                          form.setValue(
                            'initializeOpeningBalance',
                            event.target.checked,
                            { shouldValidate: true }
                          );
                        }}
                        disabled={!isFirstPeriod}
                      />
                    }
                    label={
                      isFirstPeriod
                        ? '첫 월 운영 시작과 함께 오프닝 잔액 스냅샷 생성'
                        : '첫 월 이후에는 오프닝 잔액 직접 생성을 허용하지 않음'
                    }
                  />
                  <TextField
                    label="메모"
                    multiline
                    minRows={3}
                    error={Boolean(form.formState.errors.note)}
                    helperText={
                      form.formState.errors.note?.message ??
                      '월 운영 시작 사유나 메모를 남길 수 있습니다.'
                    }
                    {...form.register('note')}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isBusy || !canOpenPeriod}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {mutation.isPending ? '운영 기간 시작 중...' : '월 운영 시작'}
                  </Button>
                </Stack>
              </form>
            </SectionCard>
          </div>
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <SectionCard
            title="월 마감"
            description="현재 열린 운영 기간을 잠그고 ClosingSnapshot과 BalanceSnapshotLine을 생성합니다. 얇은 1차 구현에서는 전표가 한 건 이상 존재하는 기간만 마감할 수 있습니다."
          >
            <Stack spacing={appLayout.cardGap}>
              <InfoRow
                label="마감 대상"
                value={openPeriod ? openPeriod.monthLabel : '현재 열린 운영 기간 없음'}
              />
              <InfoRow
                label="권한"
                value={canClosePeriod ? 'Owner' : membershipRole ?? '-'}
              />
              <TextField
                label="마감 메모"
                multiline
                minRows={3}
                value={closeNote}
                onChange={(event) => {
                  setCloseNote(event.target.value);
                }}
                helperText="월 마감 사유 또는 운영 메모를 남길 수 있습니다."
                disabled={!openPeriod || !canClosePeriod || !hasWorkspace}
              />
              <Button
                variant="contained"
                color="inherit"
                disabled={
                  !openPeriod ||
                  !canClosePeriod ||
                  !hasWorkspace ||
                  closeMutation.isPending
                }
                onClick={async () => {
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
                }}
                sx={{ alignSelf: 'flex-start' }}
              >
                {closeMutation.isPending ? '월 마감 진행 중...' : '월 마감'}
              </Button>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, xl: 7 }}>
          <SectionCard
            title="최근 마감 스냅샷"
            description="Round 7 기준으로는 가장 최근에 생성한 ClosingSnapshot 요약만 먼저 보여줍니다. 이후 Round 8에서 공식 재무제표 화면으로 확장합니다."
          >
            {latestClosingResult ? (
              <Stack spacing={appLayout.cardGap}>
                <Grid container spacing={appLayout.fieldGap}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <InfoRow
                      label="마감 월"
                      value={latestClosingResult.period.monthLabel}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <InfoRow
                      label="자산 합계"
                      value={formatWon(
                        latestClosingResult.closingSnapshot.totalAssetAmount
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <InfoRow
                      label="부채 합계"
                      value={formatWon(
                        latestClosingResult.closingSnapshot.totalLiabilityAmount
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <InfoRow
                      label="자본 합계"
                      value={formatWon(
                        latestClosingResult.closingSnapshot.totalEquityAmount
                      )}
                    />
                  </Grid>
                </Grid>
                <InfoRow
                  label="당기 손익"
                  value={formatWon(
                    latestClosingResult.closingSnapshot.periodPnLAmount
                  )}
                />
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    마감 스냅샷 라인
                  </Typography>
                  {latestClosingResult.closingSnapshot.lines.map((line) => (
                    <Typography
                      key={line.id}
                      variant="body2"
                      color="text.secondary"
                    >
                      {line.accountSubjectCode} {line.accountSubjectName}
                      {line.fundingAccountName
                        ? ` / ${line.fundingAccountName}`
                        : ''}
                      {' '}쨌 {formatWon(line.balanceAmount)}
                    </Typography>
                  ))}
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                아직 이 세션에서 생성한 마감 스냅샷이 없습니다. 현재 열린 기간을
                마감하면 요약이 여기에 표시됩니다.
              </Typography>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

function InfoRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {typeof value === 'string' ? (
        <Typography variant="body1">{value}</Typography>
      ) : (
        value
      )}
    </Stack>
  );
}
