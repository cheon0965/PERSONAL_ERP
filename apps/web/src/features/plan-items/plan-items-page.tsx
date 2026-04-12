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
  JournalEntryItem,
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
  getJournalEntries,
  journalEntriesQueryKey
} from '@/features/journal-entries/journal-entries.api';
import { resolveLatestLinkedJournalEntry } from '@/features/transactions/transactions-page.shared';
import {
  collectedTransactionsQueryKey,
  confirmCollectedTransaction
} from '@/features/transactions/transactions.api';
import { resolveCollectedTransactionActionHint } from '@/features/transactions/transaction-workflow';
import {
  buildPlanItemsFallbackView,
  generatePlanItems,
  getPlanItems,
  planItemsQueryKey
} from './plan-items.api';

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
        throw new Error('연결된 수집 거래가 없는 계획 항목은 확정할 수 없습니다.');
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
        queryClient.invalidateQueries({ queryKey: collectedTransactionsQueryKey }),
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
    const items = view?.items ?? (selectedPeriod
      ? buildPlanItemsFallbackView(selectedPeriod).items
      : []);
    if (!highlightedPlanItemId) {
      return items;
    }

    const highlighted = items.find((item) => item.id === highlightedPlanItemId);
    if (!highlighted) {
      return items;
    }

    return [highlighted, ...items.filter((item) => item.id !== highlightedPlanItemId)];
  }, [highlightedPlanItemId, selectedPeriod, view?.items]);

  const columns = React.useMemo<GridColDef<PlanItemItem>[]>(
    () => [
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
      },
      {
        field: 'executionLink',
        headerName: '실행 연결',
        flex: 1.6,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <PlanItemLinkCell
            item={params.row}
            canConfirmCollectedTransactions={canConfirmCollectedTransactions}
            confirmPending={confirmMutation.isPending}
            confirmingTransactionId={
              confirmMutation.variables?.matchedCollectedTransactionId ?? undefined
            }
            journalEntriesById={journalEntriesById}
            linkedJournalEntryIdByCollectedTransaction={
              linkedJournalEntryIdByCollectedTransaction
            }
            onConfirm={(item) => {
              setFeedback(null);
              void confirmMutation.mutateAsync(item);
            }}
          />
        )
      }
    ],
    [
      canConfirmCollectedTransactions,
      confirmMutation.isPending,
      confirmMutation.variables,
      journalEntriesById,
      linkedJournalEntryIdByCollectedTransaction
    ]
  );

  useDomainHelp({
    title: '계획 항목 사용 가이드',
    description:
      '이 화면은 반복 규칙을 선택한 운영 월의 계획 항목으로 펼치고, 각 계획이 수집 거래와 전표까지 이어졌는지 추적하는 곳입니다.',
    primaryEntity: '계획 항목',
    relatedEntities: [
      '반복 규칙',
      '운영 월',
      '거래 유형',
      '수집 거래',
      '전표'
    ],
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

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="계획 계층"
        title="계획 항목"
        description="반복 규칙을 현재 운영 월의 계획 항목으로 생성하고, 계획이 실제 수집 거래와 전표로 어디까지 이어졌는지 함께 추적하며 전표 준비가 끝난 항목은 바로 확정합니다."
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

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
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
            <Button component={Link} href="/imports" variant="text">
              업로드 배치로 이동
            </Button>
          </Stack>

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
              description="반복 규칙에서 파생된 계획 항목 목록입니다. 이제 실제 수집 거래와 전표 연결까지 함께 확인할 수 있습니다."
              rows={tableRows}
              columns={columns}
              height={420}
            />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}

function PlanItemLinkCell({
  item,
  canConfirmCollectedTransactions,
  confirmPending,
  confirmingTransactionId,
  journalEntriesById,
  linkedJournalEntryIdByCollectedTransaction,
  onConfirm
}: {
  item: PlanItemItem;
  canConfirmCollectedTransactions: boolean;
  confirmPending: boolean;
  confirmingTransactionId?: string;
  journalEntriesById: Map<string, JournalEntryItem>;
  linkedJournalEntryIdByCollectedTransaction: Map<string, string>;
  onConfirm: (item: PlanItemItem) => void;
}) {
  const linkedJournalEntry = resolvePlanItemLinkedJournalEntry(
    item,
    journalEntriesById,
    linkedJournalEntryIdByCollectedTransaction
  );
  const isConfirming =
    confirmPending &&
    item.matchedCollectedTransactionId != null &&
    item.matchedCollectedTransactionId === confirmingTransactionId;
  const actionHint = item.matchedCollectedTransactionStatus
    ? resolveCollectedTransactionActionHint(item.matchedCollectedTransactionStatus)
    : null;

  if (item.postedJournalEntryId) {
    return (
      <Button
        size="small"
        component={Link}
        href={`/journal-entries?entryId=${item.postedJournalEntryId}`}
      >
        {item.postedJournalEntryNumber ?? '전표 보기'}
      </Button>
    );
  }

  if (item.matchedCollectedTransactionId) {
    const canConfirm =
      canConfirmCollectedTransactions &&
      linkedJournalEntry == null &&
      item.matchedCollectedTransactionStatus === 'READY_TO_POST';

    return (
      <Stack spacing={0.5} sx={{ py: 0.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {item.matchedCollectedTransactionStatus ? (
            <StatusChip label={item.matchedCollectedTransactionStatus} />
          ) : null}
          {linkedJournalEntry ? (
            <Button
              size="small"
              component={Link}
              href={`/journal-entries?entryId=${linkedJournalEntry.id}`}
            >
              {linkedJournalEntry.entryNumber}
            </Button>
          ) : null}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {canConfirm ? (
            <Button
              size="small"
              variant="contained"
              disabled={isConfirming}
              onClick={() => {
                onConfirm(item);
              }}
            >
              {isConfirming ? '확정 중...' : '바로 전표 확정'}
            </Button>
          ) : null}
          <Button
            size="small"
            component={Link}
            href={`/transactions?transactionId=${item.matchedCollectedTransactionId}`}
          >
            {readPlanItemTransactionActionLabel(
              item.matchedCollectedTransactionStatus
            )}
          </Button>
        </Stack>
        {actionHint ? (
          <Typography variant="caption" color="text.secondary">
            {actionHint}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  return (
    <Typography variant="body2" color="text.secondary">
      아직 실제 거래 연결 없음
    </Typography>
  );
}

function buildPlanItemConfirmFallbackEntry(
  item: PlanItemItem,
  collectedTransactionId: string
): JournalEntryItem {
  return {
    id: `je-demo-${collectedTransactionId}`,
    entryNumber: 'DEMO',
    entryDate: `${item.plannedDate}T00:00:00.000Z`,
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    memo: item.title,
    sourceCollectedTransactionId: collectedTransactionId,
    sourceCollectedTransactionTitle: item.title,
    lines: []
  };
}

function resolvePlanItemLinkedJournalEntry(
  item: PlanItemItem,
  journalEntriesById: Map<string, JournalEntryItem>,
  linkedJournalEntryIdByCollectedTransaction: Map<string, string>
): JournalEntryItem | null {
  const collectedTransactionId = item.matchedCollectedTransactionId;
  if (!collectedTransactionId) {
    return null;
  }

  const journalEntryId =
    linkedJournalEntryIdByCollectedTransaction.get(collectedTransactionId) ?? null;
  if (!journalEntryId) {
    return null;
  }

  return resolveLatestLinkedJournalEntry(journalEntriesById, journalEntryId);
}

function readPlanItemTransactionActionLabel(
  status: PlanItemItem['matchedCollectedTransactionStatus']
) {
  switch (status) {
    case 'COLLECTED':
    case 'REVIEWED':
      return '수집 거래 보완';
    case 'READY_TO_POST':
      return '수집 거래 보기';
    default:
      return '수집 거래';
  }
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
