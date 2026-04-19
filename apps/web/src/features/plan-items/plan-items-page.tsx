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
import { PlanItemsSectionNav } from './plan-items-section-nav';

export type PlanItemsPageMode = 'list' | 'generate';

type PlanItemsPageProps = {
  mode?: PlanItemsPageMode;
};

export function PlanItemsPage({ mode = 'list' }: PlanItemsPageProps) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const highlightedPlanItemId = searchParams?.get('planItemId') ?? null;
  const periodSearchParam = searchParams?.get('periodId') ?? null;
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
    if (candidatePeriods.length === 0) {
      if (selectedPeriodId) {
        setSelectedPeriodId('');
      }
      return;
    }

    if (
      selectedPeriodId &&
      candidatePeriods.some((period) => period.id === selectedPeriodId)
    ) {
      return;
    }

    const preferredPeriodId =
      periodSearchParam &&
      candidatePeriods.some((period) => period.id === periodSearchParam)
        ? periodSearchParam
        : candidatePeriods[0]!.id;

    if (selectedPeriodId !== preferredPeriodId) {
      setSelectedPeriodId(preferredPeriodId);
    }
  }, [candidatePeriods, periodSearchParam, selectedPeriodId]);

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

  useDomainHelp(buildPlanItemsHelpContext(mode));

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

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="계획 기준"
        title={mode === 'generate' ? '계획 생성' : '계획 항목'}
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
        primaryActionLabel={mode === 'generate' ? '생성 실행' : '계획 생성'}
        primaryActionOnClick={
          mode === 'generate'
            ? () => {
                void handleGeneratePlanItems();
              }
            : undefined
        }
        primaryActionHref={mode === 'list' ? '/plan-items/generate' : undefined}
        primaryActionDisabled={mode === 'generate' ? generationDisabled : false}
        secondaryActionLabel={
          mode === 'generate' ? '계획 항목 보기' : '수집 거래 보기'
        }
        secondaryActionHref={
          mode === 'generate' ? '/plan-items' : '/transactions'
        }
      />

      <PlanItemsSectionNav />

      {highlightedPlanItemId && mode === 'list' ? (
        <Alert severity="info" variant="outlined">
          다른 화면에서 연결된 계획 항목을 열었습니다.
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

      {!selectedPeriod ? (
        <SectionCard title="운영 기간 없음">
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              잠기지 않은 운영 기간이 없습니다.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button component={Link} href="/periods" variant="contained">
                운영 월
              </Button>
              <Button component={Link} href="/recurring" variant="outlined">
                반복 규칙
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : null}

      {selectedPeriod && mode === 'generate' ? (
        <Grid container spacing={appLayout.sectionGap}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <SectionCard title="생성 대상">
              <Stack spacing={appLayout.fieldGap}>
                <TextField
                  select
                  size="small"
                  label="운영 기간"
                  value={selectedPeriodId}
                  onChange={(event) => {
                    setSelectedPeriodId(event.target.value);
                    setFeedback(null);
                  }}
                >
                  {candidatePeriods.map((period) => (
                    <MenuItem key={period.id} value={period.id}>
                      {period.monthLabel}
                    </MenuItem>
                  ))}
                </TextField>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="contained"
                    disabled={generationDisabled}
                    onClick={() => {
                      void handleGeneratePlanItems();
                    }}
                  >
                    {mutation.isPending ? '생성 중...' : '생성 실행'}
                  </Button>
                  <Button
                    component={Link}
                    href="/plan-items"
                    variant="outlined"
                  >
                    계획 항목 보기
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <SectionCard title="현재 상태">
              <Stack spacing={1.25}>
                <SummaryRow
                  label="총 계획 항목"
                  value={`${summary?.totalCount ?? 0}건`}
                />
                <SummaryRow
                  label="확정 완료"
                  value={`${summary?.confirmedCount ?? 0}건`}
                />
                <SummaryRow
                  label="계획 총액"
                  value={formatWon(summary?.totalPlannedAmount ?? 0)}
                />
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>
      ) : null}

      {selectedPeriod && mode === 'list' ? (
        <>
          <DataTableCard
            title="계획 항목"
            actions={
              <TextField
                select
                size="small"
                label="운영 기간"
                value={selectedPeriodId}
                onChange={(event) => {
                  setSelectedPeriodId(event.target.value);
                  setFeedback(null);
                }}
                sx={{ minWidth: { xs: '100%', sm: 220 } }}
              >
                {candidatePeriods.map((period) => (
                  <MenuItem key={period.id} value={period.id}>
                    {period.monthLabel}
                  </MenuItem>
                ))}
              </TextField>
            }
            rows={tableRows}
            columns={columns}
            height={460}
          />

          {!canGenerate ? (
            <Alert severity="info" variant="outlined">
              계획 생성은 소유자, 관리자, 편집자만 실행할 수 있습니다.
            </Alert>
          ) : null}

          <Grid container spacing={appLayout.sectionGap}>
            <Grid size={{ xs: 12 }}>
              <SectionCard title="요약">
                <Stack spacing={1.25}>
                  <SummaryRow
                    label="총 계획 항목"
                    value={`${summary?.totalCount ?? 0}건`}
                  />
                  <SummaryRow
                    label="계획 총액"
                    value={formatWon(summary?.totalPlannedAmount ?? 0)}
                  />
                  <SummaryRow
                    label="초안 / 연결 / 확정"
                    value={`${summary?.draftCount ?? 0} / ${summary?.matchedCount ?? 0} / ${summary?.confirmedCount ?? 0}`}
                  />
                  <SummaryRow
                    label="제외 / 만료"
                    value={`${summary?.skippedCount ?? 0} / ${summary?.expiredCount ?? 0}`}
                  />
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
        </>
      ) : null}
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

function buildPlanItemsHelpContext(mode: PlanItemsPageMode) {
  if (mode === 'generate') {
    return {
      title: '계획 생성 도움말',
      description:
        '이 화면은 선택한 운영 월에 반복 규칙을 기준으로 계획 항목을 다시 생성하거나 보강하는 작업 화면입니다.',
      primaryEntity: '계획 항목 생성',
      relatedEntities: ['반복 규칙', '운영 월', '계획 항목 목록'],
      truthSource:
        '계획 항목은 반복 규칙에서 파생된 계획 기준이며, 실제 회계 확정은 이후 수집 거래와 전표에서 이뤄집니다.',
      supplementarySections: [
        {
          title: '이 탭에서 하는 일',
          items: [
            '잠기지 않은 운영 월을 선택해 해당 월에 필요한 계획 항목을 생성합니다.',
            '반복 규칙 변경 이후 누락된 계획을 다시 보강할 때도 이 화면을 사용합니다.',
            '생성이 끝나면 계획 항목 목록으로 이동해 초안, 연결, 확정 흐름을 이어서 확인합니다.'
          ]
        },
        {
          title: '이어지는 화면',
          links: [
            {
              title: '계획 항목',
              description: '생성 결과와 확정 진행 상태를 목록에서 확인합니다.',
              href: '/plan-items',
              actionLabel: '계획 항목 보기'
            },
            {
              title: '수집 거래',
              description: '연결된 실제 거래를 검토하고 전표 준비 상태를 확인합니다.',
              href: '/transactions',
              actionLabel: '수집 거래 보기'
            }
          ]
        }
      ],
      readModelNote:
        '계획 생성은 계획 기준을 준비하는 단계입니다. 공식 숫자는 연결된 수집 거래와 전표 확정 뒤에만 만들어집니다.'
    };
  }

  return {
    title: '계획 항목 도움말',
    description:
      '이 화면은 운영 월별 계획 항목을 보고, 실제 거래 연결과 확정 진행 상태를 추적하는 목록 화면입니다.',
    primaryEntity: '계획 항목',
    relatedEntities: ['반복 규칙', '운영 월', '수집 거래', '전표'],
    truthSource:
      '계획 항목은 반복 규칙에서 파생된 계획 기준이며, 회계 확정은 연결된 수집 거래와 전표에서 이뤄집니다.',
    supplementarySections: [
      {
        title: '이 탭에서 하는 일',
        items: [
          '운영 월별 계획 항목을 보며 초안, 연결, 확정 상태가 어디까지 왔는지 확인합니다.',
          '강조된 계획 항목이 있으면 다른 화면에서 넘어온 연결 대상인지 먼저 확인합니다.',
          '실제 거래 연결과 전표 반영 여부는 수집 거래와 전표 조회 화면으로 이어서 확인합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '수집 거래',
            description: '계획 항목과 연결된 실제 거래를 검토하고 전표 준비 상태까지 이어서 확인합니다.',
            href: '/transactions',
            actionLabel: '수집 거래 보기'
          },
          {
            title: '전표 조회',
            description: '확정된 계획이 실제 전표로 반영됐는지 공식 회계 기준으로 확인합니다.',
            href: '/journal-entries',
            actionLabel: '전표 보기'
          },
          {
            title: '계획 생성',
            description: '선택한 운영 월의 계획 항목을 다시 생성하거나 보강합니다.',
            href: '/plan-items/generate',
            actionLabel: '계획 생성 보기'
          }
        ]
      }
    ],
    readModelNote:
      '계획 항목은 실행 전 기준선입니다. 공식 손익과 자금 흐름은 연결된 수집 거래가 전표로 확정된 뒤에만 판단합니다.'
  };
}
