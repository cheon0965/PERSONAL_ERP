'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountingPeriodItem,
  PlanItemItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { formatDate, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import {
  buildPlanItemsFallbackView,
  generatePlanItems,
  getPlanItems,
  planItemsQueryKey
} from './plan-items.api';

const columns: GridColDef<PlanItemItem>[] = [
  {
    field: 'plannedDate',
    headerName: '계획일',
    flex: 0.9,
    valueFormatter: (value) => formatDate(String(value))
  },
  {
    field: 'title',
    headerName: '제목',
    flex: 1.4
  },
  {
    field: 'plannedAmount',
    headerName: '계획 금액',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  },
  {
    field: 'ledgerTransactionTypeName',
    headerName: '거래 유형',
    flex: 1
  },
  {
    field: 'fundingAccountName',
    headerName: '자금수단',
    flex: 1
  },
  {
    field: 'categoryName',
    headerName: '카테고리',
    flex: 1
  },
  {
    field: 'status',
    headerName: '상태',
    flex: 0.9,
    renderCell: (params) => <StatusChip label={String(params.value)} />
  }
];

export function PlanItemsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const [selectedPeriodId, setSelectedPeriodId] = React.useState('');
  const [feedback, setFeedback] = React.useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);

  const periodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });

  const candidatePeriods = React.useMemo(
    () =>
      (periodsQuery.data ?? []).filter((period) => period.status !== 'LOCKED'),
    [periodsQuery.data]
  );

  React.useEffect(() => {
    if (!selectedPeriodId && candidatePeriods.length > 0) {
      setSelectedPeriodId(candidatePeriods[0]!.id);
    }
  }, [candidatePeriods, selectedPeriodId]);

  const selectedPeriod =
    candidatePeriods.find((period) => period.id === selectedPeriodId) ?? null;

  const planItemsQuery = useQuery({
    queryKey: planItemsQueryKey(selectedPeriodId || null),
    queryFn: () => getPlanItems(selectedPeriodId || null, selectedPeriod),
    enabled: Boolean(selectedPeriodId)
  });

  const mutation = useMutation({
    mutationFn: (period: AccountingPeriodItem) =>
      generatePlanItems({ periodId: period.id }, period),
    onSuccess: async (result) => {
      queryClient.setQueryData(planItemsQueryKey(result.period.id), {
        period: result.period,
        items: result.items,
        summary: result.summary
      });
      await queryClient.invalidateQueries({
        queryKey: planItemsQueryKey(result.period.id)
      });
    }
  });

  const membershipRole = user?.currentWorkspace?.membership.role ?? null;
  const canGenerate =
    membershipRole === 'OWNER' ||
    membershipRole === 'MANAGER' ||
    membershipRole === 'EDITOR';
  const view = planItemsQuery.data;

  useDomainHelp({
    title: '계획 항목 개요',
    description:
      '반복 규칙을 기준으로 현재 운영 월 안의 계획 항목을 생성합니다. 계획 항목은 아직 확정 전 단계의 운영 계획이며, 이후 수집 거래와 전표 흐름에서 실제화됩니다.',
    primaryEntity: '계획 항목',
    relatedEntities: [
      '반복 규칙',
      '운영 월',
      '거래 유형',
      '수집 거래',
      '전표'
    ],
    truthSource:
      '계획 항목은 반복 규칙에서 파생된 계획 기준이며, 회계 확정은 이후 수집 거래와 전표에서 이뤄집니다.',
    readModelNote:
      '현재 화면은 특정 기간 안의 계획 항목을 생성하고 상태를 검토하는 운영 화면입니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="계획 계층"
        title="계획 항목"
        description="반복 규칙을 현재 운영 월의 계획 항목으로 생성하고, 계획 상태와 예상 금액을 확인합니다. 아직 회계 확정은 아니며 이후 수집 거래와 전표로 이어집니다."
      />

      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}

      {periodsQuery.error ? (
        <QueryErrorAlert
          title="운영 기간 목록을 불러오지 못했습니다."
          error={periodsQuery.error}
        />
      ) : null}

      {planItemsQuery.error ? (
        <QueryErrorAlert
          title="계획 항목을 불러오지 못했습니다."
          error={planItemsQuery.error}
        />
      ) : null}

      <SectionCard
        title="생성 대상 기간"
        description="잠기지 않은 운영 기간에서만 계획 항목을 생성합니다. 같은 규칙과 날짜 조합은 중복 생성되지 않습니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <TextField
            select
            label="운영 기간"
            value={selectedPeriodId}
            onChange={(event) => {
              setSelectedPeriodId(event.target.value);
              setFeedback(null);
            }}
            disabled={candidatePeriods.length === 0}
            helperText={
              candidatePeriods.length > 0
                ? '현재 계획을 생성할 운영 기간을 선택해 주세요.'
                : '잠기지 않은 운영 기간이 없습니다.'
            }
          >
            {candidatePeriods.map((period) => (
              <MenuItem key={period.id} value={period.id}>
                {period.monthLabel}
              </MenuItem>
            ))}
          </TextField>

          <div>
            <Button
              variant="contained"
              color="inherit"
              disabled={!selectedPeriod || !canGenerate || mutation.isPending}
              onClick={async () => {
                if (!selectedPeriod) {
                  return;
                }

                setFeedback(null);

                try {
                  const result = await mutation.mutateAsync(selectedPeriod);
                  setFeedback({
                    severity: 'success',
                    message: `${result.period.monthLabel} 계획 항목을 생성했습니다. 신규 ${result.generation.createdCount}건, 기존 유지 ${result.generation.skippedExistingCount}건, 제외 규칙 ${result.generation.excludedRuleCount}건입니다.`
                  });
                } catch (error) {
                  setFeedback({
                    severity: 'error',
                    message:
                      error instanceof Error
                        ? error.message
                        : '계획 항목을 생성하지 못했습니다.'
                  });
                }
              }}
            >
              {mutation.isPending ? '생성 중...' : '계획 항목 생성'}
            </Button>
          </div>

          {!canGenerate ? (
            <Alert severity="info" variant="outlined">
              계획 항목 생성은 소유자, 관리자, 편집자만 실행할 수 있습니다.
            </Alert>
          ) : null}
        </Stack>
      </SectionCard>

      {!selectedPeriod ? (
        <SectionCard
          title="생성할 기간이 없습니다"
          description="먼저 잠기지 않은 운영 기간을 준비해 주세요."
        >
          <Typography variant="body2" color="text.secondary">
            운영 기간이 열려 있어야 계획 항목을 생성할 수 있습니다.
          </Typography>
        </SectionCard>
      ) : (
        <Grid container spacing={appLayout.sectionGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <SectionCard
              title="계획 요약"
              description="현재 선택한 월의 계획 항목 상태 집계입니다."
            >
              <Stack spacing={1.25}>
                <SummaryRow
                  label="총 계획 항목"
                  value={String(view?.summary.totalCount ?? 0)}
                />
                <SummaryRow
                  label="계획 총액"
                  value={formatWon(view?.summary.totalPlannedAmount ?? 0)}
                />
                <SummaryRow
                  label="초안 / 연결됨 / 확정됨"
                  value={`${view?.summary.draftCount ?? 0} / ${view?.summary.matchedCount ?? 0} / ${view?.summary.confirmedCount ?? 0}`}
                />
                <SummaryRow
                  label="제외 / 만료"
                  value={`${view?.summary.skippedCount ?? 0} / ${view?.summary.expiredCount ?? 0}`}
                />
              </Stack>
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <DataTableCard
              title="기간 계획 항목"
              description="반복 규칙에서 파생된 계획 항목 목록입니다. 아직 수집 거래나 전표로 확정되기 전 단계입니다."
              rows={
                view?.items ?? buildPlanItemsFallbackView(selectedPeriod).items
              }
              columns={columns}
              height={420}
            />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}
