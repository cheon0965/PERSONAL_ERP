'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
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
import { useAuthSession } from '@/shared/auth/auth-provider';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from '@/features/journal-entries/journal-entries.api';
import {
  collectedTransactionsQueryKey,
  confirmCollectedTransaction
} from '@/features/transactions/transactions.api';
import {
  buildPlanItemsFallbackView,
  generatePlanItems,
  getPlanItems,
  planItemsQueryKey
} from './plan-items.api';
import {
  buildPlanItemColumns,
  buildPlanItemConfirmFallbackEntry
} from './plan-items-page.columns';

export function PlanItemsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const highlightedPlanItemId = searchParams?.get('planItemId') ?? null;
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
  const journalEntriesQuery = useQuery({
    queryKey: journalEntriesQueryKey,
    queryFn: getJournalEntries
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
  const confirmMutation = useMutation({
    mutationFn: (item: PlanItemItem) => {
      const transactionId = item.matchedCollectedTransactionId;
      if (!transactionId) {
        throw new Error(
          '연결된 수집 거래가 없는 계획 항목은 확정할 수 없습니다.'
        );
      }

      return confirmCollectedTransaction(
        transactionId,
        buildPlanItemConfirmFallbackEntry(item, transactionId)
      );
    },
    onSuccess: async (createdEntry) => {
      setFeedback({
        severity: 'success',
        message: `${createdEntry.entryNumber} 전표를 생성하고 연결된 수집 거래를 확정했습니다.`
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plan-items'] }),
        queryClient.invalidateQueries({
          queryKey: collectedTransactionsQueryKey
        }),
        queryClient.invalidateQueries({ queryKey: journalEntriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: accountingPeriodsQueryKey })
      ]);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '연결된 수집 거래를 전표로 확정하지 못했습니다.'
      });
    }
  });

  const membershipRole = user?.currentWorkspace?.membership.role ?? null;
  const canGenerate =
    membershipRole === 'OWNER' ||
    membershipRole === 'MANAGER' ||
    membershipRole === 'EDITOR';
  const canConfirmCollectedTransactions =
    membershipRole === 'OWNER' ||
    membershipRole === 'MANAGER' ||
    membershipRole === 'EDITOR';
  const view = planItemsQuery.data;
  const summary = view?.summary ?? null;
  const journalEntriesById = React.useMemo(
    () =>
      new Map(
        (journalEntriesQuery.data ?? []).map(
          (entry) => [entry.id, entry] as const
        )
      ),
    [journalEntriesQuery.data]
  );
  const linkedJournalEntryIdByCollectedTransaction = React.useMemo(() => {
    const mapping = new Map<string, string>();
    for (const entry of journalEntriesQuery.data ?? []) {
      if (!entry.sourceCollectedTransactionId) {
        continue;
      }

      mapping.set(entry.sourceCollectedTransactionId, entry.id);
    }

    return mapping;
  }, [journalEntriesQuery.data]);
  const tableRows = React.useMemo(() => {
    const items =
      view?.items ??
      (selectedPeriod ? buildPlanItemsFallbackView(selectedPeriod).items : []);
    if (!highlightedPlanItemId) {
      return items;
    }

    const highlighted = items.find((item) => item.id === highlightedPlanItemId);
    if (!highlighted) {
      return items;
    }

    return [
      highlighted,
      ...items.filter((item) => item.id !== highlightedPlanItemId)
    ];
  }, [highlightedPlanItemId, selectedPeriod, view?.items]);

  const columns = React.useMemo(
    () =>
      buildPlanItemColumns({
        canConfirmCollectedTransactions,
        confirmPending: confirmMutation.isPending,
        confirmingTransactionId:
          confirmMutation.variables?.matchedCollectedTransactionId ?? undefined,
        journalEntriesById,
        linkedJournalEntryIdByCollectedTransaction,
        onConfirm: (item) => {
          setFeedback(null);
          void confirmMutation.mutateAsync(item);
        }
      }),
    [
      canConfirmCollectedTransactions,
      confirmMutation.isPending,
      confirmMutation.variables,
      journalEntriesById,
      linkedJournalEntryIdByCollectedTransaction
    ]
  );
  const generationDisabled =
    !selectedPeriod || !canGenerate || mutation.isPending;

  useDomainHelp({
    title: '계획 항목 사용 가이드',
    description:
      '이 화면은 반복 규칙을 선택한 운영 월의 계획 항목으로 펼치고, 각 계획이 수집 거래와 전표까지 이어졌는지 추적하는 곳입니다.',
    primaryEntity: '계획 항목',
    relatedEntities: ['반복 규칙', '운영 월', '거래 유형', '수집 거래', '전표'],
    truthSource:
      '계획 항목은 반복 규칙에서 파생된 계획 기준이며, 회계 확정은 연결된 수집 거래를 통해 전표로 이뤄집니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '생성 대상 기간에서 잠기지 않은 운영 월을 선택합니다.',
          '계획 항목 생성을 눌러 반복 규칙을 해당 월의 계획으로 펼칩니다.',
          '계획 요약에서 초안, 연결됨, 확정됨 수를 확인합니다.',
          '실행 연결 칸에서 수집 거래 보완이 보이면 수집 거래 화면으로 이동해 부족한 분류를 채웁니다.',
          '바로 전표 확정이 보이면 연결 수집 거래가 전표 준비 상태이므로 이 화면에서 바로 확정할 수 있습니다.'
        ]
      },
      {
        title: '다음 단계',
        items: [
          '실제 입출금 원본이 파일이나 붙여넣기라면 업로드 배치로 이동해 행을 수집 거래로 승격합니다.',
          '수기 입력이나 보완이 필요하면 수집 거래 화면에서 직접 정리합니다.',
          '전표 번호가 연결되면 전표 조회 화면에서 공식 전표 라인을 확인합니다.'
        ]
      }
    ],
    readModelNote:
      '계획 항목 자체는 아직 실제 거래나 공식 전표가 아닙니다. 전표 번호가 연결된 뒤부터 공식 회계 흐름에 반영됩니다.'
  });

  const handleGeneratePlanItems = React.useCallback(async () => {
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
  }, [mutation, selectedPeriod]);

  const tableActions = (
    <Stack
      direction={{ xs: 'column', lg: 'row' }}
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      alignItems={{ xs: 'stretch', lg: 'center' }}
      sx={{ width: { xs: '100%', lg: 'auto' } }}
    >
      <TextField
        select
        size="small"
        label="운영 기간"
        value={selectedPeriodId}
        onChange={(event) => {
          setSelectedPeriodId(event.target.value);
          setFeedback(null);
        }}
        disabled={candidatePeriods.length === 0}
        sx={{ minWidth: { xs: '100%', sm: 220 } }}
      >
        {candidatePeriods.map((period) => (
          <MenuItem key={period.id} value={period.id}>
            {period.monthLabel}
          </MenuItem>
        ))}
      </TextField>
      <Button
        size="small"
        variant="contained"
        color="inherit"
        disabled={generationDisabled}
        onClick={() => {
          void handleGeneratePlanItems();
        }}
      >
        {mutation.isPending ? '생성 중...' : '계획 항목 생성'}
      </Button>
      <Button component={Link} href="/transactions" size="small" variant="outlined">
        수집 거래 보기
      </Button>
    </Stack>
  );

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="계획 계층"
        title="계획 항목"
        description="선택한 운영 월의 계획 항목을 생성하고, 실제 수집 거래와 전표까지 어디까지 이어졌는지 목록 중심으로 추적합니다."
        badges={[
          {
            label: selectedPeriod?.monthLabel ?? '운영 기간 선택 필요',
            color: selectedPeriod ? 'primary' : 'warning'
          },
          {
            label: canGenerate ? '생성 가능' : '조회 전용',
            color: canGenerate ? 'success' : 'default'
          }
        ]}
        metadata={[
          {
            label: '총 계획 항목',
            value: `${summary?.totalCount ?? 0}건`
          },
          {
            label: '확정 완료',
            value: `${summary?.confirmedCount ?? 0}건`
          },
          {
            label: '계획 총액',
            value: formatWon(summary?.totalPlannedAmount ?? 0)
          }
        ]}
        primaryActionLabel="계획 항목 생성"
        primaryActionOnClick={() => {
          void handleGeneratePlanItems();
        }}
        primaryActionDisabled={generationDisabled}
        secondaryActionLabel="반복 규칙 보기"
        secondaryActionHref="/recurring"
      />

      {highlightedPlanItemId ? (
        <Alert severity="info" variant="outlined">
          다른 화면에서 연결된 계획 항목을 열었습니다. 관련 항목을 목록 상단에
          먼저 배치했습니다.
        </Alert>
      ) : null}

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

      <DataTableCard
        title="기간 계획 항목"
        description={
          selectedPeriod
            ? `${selectedPeriod.monthLabel} 운영 월의 계획 항목을 먼저 보고, 연결된 수집 거래와 전표 상태를 같은 표에서 추적합니다.`
            : '잠기지 않은 운영 기간을 선택하면 계획 항목 생성과 목록 조회를 바로 시작할 수 있습니다.'
        }
        actions={tableActions}
        rows={selectedPeriod ? tableRows : []}
        columns={columns}
        height={selectedPeriod ? 460 : 320}
      />

      {!canGenerate ? (
        <Alert severity="info" variant="outlined">
          계획 항목 생성은 소유자, 관리자, 편집자만 실행할 수 있습니다.
        </Alert>
      ) : null}

      {!selectedPeriod ? (
        <SectionCard
          title="생성할 기간이 없습니다"
          description="먼저 잠기지 않은 운영 기간을 준비해 주세요."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              운영 기간이 열려 있어야 계획 항목을 생성할 수 있습니다.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button component={Link} href="/periods" variant="contained">
                운영 월 보기
              </Button>
              <Button component={Link} href="/recurring" variant="outlined">
                반복 규칙 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : (
        <Grid container spacing={appLayout.sectionGap}>
          <Grid size={{ xs: 12, lg: 4 }}>
            <SectionCard
              title="계획 요약"
              description="현재 선택한 운영 월에서 계획이 실제 실행으로 얼마나 이어졌는지 보여줍니다."
            >
              <Stack spacing={1.25}>
                <SummaryRow
                  label="총 계획 항목"
                  value={String(summary?.totalCount ?? 0)}
                />
                <SummaryRow
                  label="계획 총액"
                  value={formatWon(summary?.totalPlannedAmount ?? 0)}
                />
                <SummaryRow
                  label="초안 / 연결됨 / 확정됨"
                  value={`${summary?.draftCount ?? 0} / ${summary?.matchedCount ?? 0} / ${summary?.confirmedCount ?? 0}`}
                />
                <SummaryRow
                  label="제외 / 만료"
                  value={`${summary?.skippedCount ?? 0} / ${summary?.expiredCount ?? 0}`}
                />
              </Stack>
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <SectionCard
              title="실행 연결 안내"
              description="표를 읽을 때는 계획 기준, 실제 거래 연결, 공식 전표 연결 순서로 확인하면 가장 빠릅니다."
            >
              <Stack spacing={1.25}>
                <Typography variant="body2" color="text.secondary">
                  `READY_TO_POST` 상태면 이 화면에서 바로 전표 확정을 실행할 수 있습니다.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  아직 분류 보완이 필요하면 수집 거래 화면으로 이동해 카테고리와 자금수단을 먼저 정리합니다.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button component={Link} href="/transactions" variant="contained">
                    수집 거래로 이동
                  </Button>
                  <Button component={Link} href="/journal-entries" variant="outlined">
                    전표 조회 보기
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>
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
