'use client';

import * as React from 'react';
import type { Route } from 'next';
import type { GridColDef } from '@mui/x-data-grid';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  Typography
} from '@mui/material';
import type { AccountingPeriodItem, JournalEntryItem } from '@personal-erp/contracts';
import { useRouter } from 'next/navigation';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { formatDate, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  JournalEntryAdjustmentDialog,
  type JournalEntryAdjustmentMode
} from './journal-entry-adjustment-dialog';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from './journal-entries.api';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type AdjustmentSelection = {
  mode: JournalEntryAdjustmentMode;
  entry: JournalEntryItem;
} | null;

type JournalEntriesLayout = 'list' | 'split' | 'detail';

export function JournalEntriesPage({
  highlightedEntryId = null,
  layout = highlightedEntryId ? 'split' : 'list'
}: {
  highlightedEntryId?: string | null;
  layout?: JournalEntriesLayout;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [selectedAdjustment, setSelectedAdjustment] =
    React.useState<AdjustmentSelection>(null);
  const journalEntriesQuery = useQuery({
    queryKey: journalEntriesQueryKey,
    queryFn: getJournalEntries
  });
  const currentPeriodQuery = useQuery({
    queryKey: currentAccountingPeriodQueryKey,
    queryFn: getCurrentAccountingPeriod
  });

  const entries = React.useMemo(() => {
    const data = journalEntriesQuery.data ?? [];
    if (!highlightedEntryId) {
      return data;
    }

    const highlighted = data.find((item) => item.id === highlightedEntryId);
    if (!highlighted) {
      return data;
    }

    return [
      highlighted,
      ...data.filter((item) => item.id !== highlightedEntryId)
    ];
  }, [highlightedEntryId, journalEntriesQuery.data]);

  const currentPeriod = currentPeriodQuery.data ?? null;
  const selectedEntry = React.useMemo(() => {
    if (entries.length === 0) {
      return null;
    }

    if (!highlightedEntryId) {
      return entries[0] ?? null;
    }

    const highlightedEntry =
      entries.find((entry) => entry.id === highlightedEntryId) ?? null;

    if (highlightedEntry) {
      return highlightedEntry;
    }

    return layout === 'detail' ? null : (entries[0] ?? null);
  }, [entries, highlightedEntryId, layout]);
  const selectedEntryCanAdjust =
    selectedEntry?.status === 'POSTED' && Boolean(currentPeriod);
  const isDetailLayout = layout === 'detail';
  const isSplitLayout = layout === 'split';
  const pageTitle = isDetailLayout
    ? selectedEntry
      ? `${selectedEntry.entryNumber} 전표 상세`
      : '전표 상세'
    : '전표 조회';
  const pageDescription = isDetailLayout
    ? '선택한 전표의 라인, 조정 계보, 후속 조정 액션을 한 화면에서 집중해서 검토합니다.'
    : '전표 목록에서 대상을 고른 뒤 상세 라인과 조정 이력을 검토하는 공식 회계 확인 화면입니다.';

  const journalEntryColumns = React.useMemo<GridColDef<JournalEntryItem>[]>(
    () => [
      {
        field: 'entryNumber',
        headerName: '전표번호',
        flex: 1,
        minWidth: 130,
        renderCell: (params) => (
          <Button
            size="small"
            component={Link}
            href={`/journal-entries/${params.row.id}`}
          >
            {params.row.entryNumber}
          </Button>
        )
      },
      {
        field: 'entryDate',
        headerName: '전표일',
        flex: 0.9,
        minWidth: 110,
        valueFormatter: (value) => formatDate(String(value))
      },
      {
        field: 'status',
        headerName: '상태',
        flex: 0.8,
        minWidth: 110,
        renderCell: (params) => <StatusChip label={String(params.value)} />
      },
      {
        field: 'sourceKind',
        headerName: '출처',
        flex: 1,
        minWidth: 130,
        valueFormatter: (value) => readJournalEntrySourceKindLabel(String(value))
      },
      {
        field: 'sourceCollectedTransactionTitle',
        headerName: '원본 거래',
        flex: 1.4,
        minWidth: 180,
        valueGetter: (_value, row) => row.sourceCollectedTransactionTitle ?? '-'
      },
      {
        field: 'lines',
        headerName: '라인',
        flex: 0.7,
        minWidth: 90,
        sortable: false,
        valueGetter: (_value, row) => `${row.lines.length}건`
      },
      {
        field: 'totalAmount',
        headerName: '금액',
        flex: 0.9,
        minWidth: 120,
        valueGetter: (_value, row) => readJournalEntryTotalAmount(row),
        valueFormatter: (value) => formatWon(Number(value))
      },
      {
        field: 'actions',
        headerName: '동작',
        flex: 0.8,
        minWidth: 110,
        sortable: false,
        filterable: false,
        renderCell: (params) =>
          params.row.id === selectedEntry?.id ? (
            <Typography variant="caption" color="text.secondary">
              선택됨
            </Typography>
          ) : (
            <Button
              size="small"
              component={Link}
              href={`/journal-entries/${params.row.id}`}
            >
              상세
            </Button>
          )
      }
    ],
    [selectedEntry?.id]
  );

  useDomainHelp({
    title: '전표 조회 사용 가이드',
    description:
      '이 화면은 수집 거래가 전표로 확정된 뒤 공식 회계 라인을 검토하는 곳입니다. 이미 확정된 내용을 되돌리거나 고쳐야 할 때도 삭제 대신 반전 전표 또는 정정 전표를 만듭니다.',
    primaryEntity: '전표',
    relatedEntities: [
      '전표 라인',
      '수집 거래',
      '계정과목',
      '입출금 계정',
      '운영 월'
    ],
    truthSource:
      '월 운영 중 확정된 거래는 반드시 전표로 이어지고, 이후 마감과 보고는 이 전표를 기준으로 진행됩니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '목록에서 전표 번호, 전표 일자, 원본 수집 거래를 확인합니다.',
          '선택한 전표 상세에서 차변과 대변 라인이 의도한 계정과목과 자금수단으로 잡혔는지 확인합니다.',
          '거래를 취소해야 하면 반전 전표를 생성합니다.',
          '분류나 금액을 바로잡아야 하면 정정 전표를 생성합니다.',
          '조정 전표가 생기면 조정 계보에서 원본과 후속 전표 연결을 확인합니다.'
        ]
      },
      {
        title: '막히면 확인',
        items: [
          '반전/정정 버튼은 현재 열린 운영 기간이 있어야 사용할 수 있습니다.',
          'POSTED 상태 전표만 추가 조정 대상으로 봅니다.',
          '아직 전표가 없다면 수집 거래 또는 계획 항목 화면에서 전표 준비 거래를 먼저 확정합니다.'
        ]
      }
    ],
    readModelNote:
      '전표는 이후 월 마감, 재무제표, 차기 이월의 기준입니다. 확정 후 수정은 원본 삭제가 아니라 조정 전표로 이력을 남깁니다.'
  });

  return (
    <>
      <Stack spacing={appLayout.pageGap}>
        <PageHeader
          eyebrow="전표"
          title={pageTitle}
          description={pageDescription}
          badges={[
            {
              label: currentPeriod?.monthLabel ?? '열린 운영 월 없음',
              color: currentPeriod ? 'primary' : 'warning'
            },
            selectedEntry
              ? {
                  label: selectedEntry.status,
                  color: selectedEntry.status === 'POSTED' ? 'success' : 'default'
                }
              : {
                  label: '전표 없음',
                  color: 'default'
                }
          ]}
          metadata={[
            {
              label: '전표 수',
              value: `${entries.length}건`
            },
            {
              label: isDetailLayout ? '현재 전표' : '선택 전표',
              value: selectedEntry?.entryNumber ?? '-'
            },
            {
              label: '선택 금액',
              value: selectedEntry
                ? formatWon(readJournalEntryTotalAmount(selectedEntry))
                : '-'
            }
          ]}
          primaryActionLabel="정정 전표 생성"
          primaryActionOnClick={() => {
            if (!selectedEntry) {
              return;
            }

            setFeedback(null);
            setSelectedAdjustment({ mode: 'correct', entry: selectedEntry });
          }}
          primaryActionDisabled={!selectedEntryCanAdjust}
          secondaryActionLabel="반전 전표 생성"
          secondaryActionOnClick={() => {
            if (!selectedEntry) {
              return;
            }

            setFeedback(null);
            setSelectedAdjustment({ mode: 'reverse', entry: selectedEntry });
          }}
          secondaryActionDisabled={!selectedEntryCanAdjust}
        />

        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}
        {currentPeriodQuery.error ? (
          <QueryErrorAlert
            title="현재 운영 기간을 불러오지 못했습니다."
            error={currentPeriodQuery.error}
          />
        ) : null}
        {journalEntriesQuery.error ? (
          <QueryErrorAlert
            title="전표 목록을 불러오지 못했습니다."
            error={journalEntriesQuery.error}
          />
        ) : null}

        {currentPeriod ? (
          <Alert severity="info" variant="outlined">
            현재 열린 운영 기간은 {currentPeriod.monthLabel}이며, 반전/정정 전표는
            이 기간 안의 일자로만 생성할 수 있습니다.
          </Alert>
        ) : (
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Button component={Link} href="/periods" size="small">
                운영 월 확인
              </Button>
            }
          >
            현재 열린 운영 기간이 없어 반전/정정 전표 버튼이 잠겨 있습니다.
          </Alert>
        )}

        {entries.length === 0 ? (
          <SectionCard
            title="최근 전표가 없습니다"
            description="수집 거래를 전표로 확정하면 이 화면에서 최근 전표와 라인을 바로 확인할 수 있습니다."
          >
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                아직 확정된 전표가 없습니다. 수집 거래 화면에서 전표 준비 상태의
                거래를 선택해 전표 확정을 진행해 주세요.
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                <Button component={Link} href="/transactions" variant="contained">
                  수집 거래 보기
                </Button>
                <Button component={Link} href="/periods" variant="outlined">
                  운영 월 보기
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        ) : isDetailLayout ? (
          selectedEntry ? (
            <Stack spacing={appLayout.sectionGap}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                <Button component={Link} href="/journal-entries" variant="outlined">
                  전표 목록으로
                </Button>
                {selectedEntry.sourceCollectedTransactionId ? (
                  <Button
                    component={Link}
                    href={`/transactions?transactionId=${selectedEntry.sourceCollectedTransactionId}`}
                    variant="text"
                  >
                    원본 거래 보기
                  </Button>
                ) : null}
              </Stack>
              <JournalEntryDetailCard
                entry={selectedEntry}
                currentPeriod={currentPeriod}
                onReverse={() => {
                  setFeedback(null);
                  setSelectedAdjustment({ mode: 'reverse', entry: selectedEntry });
                }}
                onCorrect={() => {
                  setFeedback(null);
                  setSelectedAdjustment({ mode: 'correct', entry: selectedEntry });
                }}
              />
            </Stack>
          ) : (
            <SectionCard
              title="선택한 전표를 찾지 못했습니다"
              description="전표가 삭제되었거나 현재 목록에 없는 경우일 수 있습니다."
            >
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  최신 전표 목록으로 돌아가서 다시 선택해 주세요.
                </Typography>
                <Button component={Link} href="/journal-entries" variant="contained">
                  전표 목록 보기
                </Button>
              </Stack>
            </SectionCard>
          )
        ) : (
          <Stack spacing={appLayout.sectionGap}>
            <DataTableCard
              title="전표 목록"
              description={
                isSplitLayout
                  ? '전표 번호를 선택하면 아래에서 상세 라인, 조정 계보, 후속 조정 액션을 확인할 수 있습니다.'
                  : '목록에서 전표 번호를 선택하면 전용 상세 화면으로 이동해 라인과 조정 이력을 검토합니다.'
              }
              rows={entries}
              columns={journalEntryColumns}
              height={420}
            />

            {isSplitLayout && selectedEntry ? (
              <JournalEntryDetailCard
                entry={selectedEntry}
                currentPeriod={currentPeriod}
                onReverse={() => {
                  setFeedback(null);
                  setSelectedAdjustment({ mode: 'reverse', entry: selectedEntry });
                }}
                onCorrect={() => {
                  setFeedback(null);
                  setSelectedAdjustment({ mode: 'correct', entry: selectedEntry });
                }}
              />
            ) : null}
          </Stack>
        )}
      </Stack>

      <JournalEntryAdjustmentDialog
        open={selectedAdjustment != null}
        mode={selectedAdjustment?.mode ?? null}
        entry={selectedAdjustment?.entry ?? null}
        currentPeriod={currentPeriod}
        onClose={() => setSelectedAdjustment(null)}
        onCompleted={(createdEntry, mode) => {
          setFeedback({
            severity: 'success',
            message:
              mode === 'reverse'
                ? `${createdEntry.entryNumber} 반전 전표를 생성했습니다.`
                : `${createdEntry.entryNumber} 정정 전표를 생성했습니다.`
          });
          setSelectedAdjustment(null);
          router.replace(`/journal-entries/${createdEntry.id}` as Route);
        }}
      />
    </>
  );
}

function JournalEntryDetailCard({
  entry,
  currentPeriod,
  onReverse,
  onCorrect
}: {
  entry: JournalEntryItem;
  currentPeriod: AccountingPeriodItem | null;
  onReverse: () => void;
  onCorrect: () => void;
}) {
  const canAdjust = entry.status === 'POSTED' && Boolean(currentPeriod);

  return (
    <SectionCard
      title={`${entry.entryNumber} 전표 상세`}
      description={buildJournalEntryDescription(entry)}
    >
      <Stack spacing={appLayout.cardGap}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={appLayout.fieldGap}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={appLayout.fieldGap}
            useFlexGap
            flexWrap="wrap"
          >
            <DetailFact label="전표 상태" value={<StatusChip label={entry.status} />} />
            <DetailFact label="전표 일자" value={formatDate(entry.entryDate)} />
            <DetailFact
              label="총 금액"
              value={formatWon(readJournalEntryTotalAmount(entry))}
            />
            <DetailFact
              label="원본 거래"
              value={entry.sourceCollectedTransactionTitle ?? '-'}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {entry.sourceCollectedTransactionId ? (
              <Button
                size="small"
                component={Link}
                href={`/transactions?transactionId=${entry.sourceCollectedTransactionId}`}
                variant="outlined"
              >
                원본 거래 보기
              </Button>
            ) : null}
            <Button
              size="small"
              variant="outlined"
              disabled={!canAdjust}
              onClick={onReverse}
            >
              반전 전표
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={!canAdjust}
              onClick={onCorrect}
            >
              정정 전표
            </Button>
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          {entry.status !== 'POSTED'
            ? '이미 반전 또는 정정 처리된 전표는 추가 조정 대상이 아닙니다.'
            : currentPeriod
              ? `${currentPeriod.monthLabel} 운영 기간 안에서 조정 전표를 생성할 수 있습니다.`
              : '현재 열린 운영 기간이 없어 조정 전표를 시작할 수 없습니다.'}
        </Typography>

        {hasAdjustmentMetadata(entry) ? (
          <Box
            sx={{
              px: appLayout.cardPadding,
              py: { xs: 1.25, md: 1.5 },
              borderRadius: 2,
              bgcolor: 'background.default',
              border: (theme) => `1px solid ${theme.palette.divider}`
            }}
          >
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">조정 계보</Typography>
              {buildAdjustmentMetadataRows(entry).map((row) => (
                <Typography
                  key={`${entry.id}-${row.label}`}
                  variant="body2"
                  color="text.secondary"
                >
                  {row.label}: {row.value}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : null}

        {entry.memo ? (
          <Box
            sx={{
              px: appLayout.cardPadding,
              py: { xs: 1.25, md: 1.5 },
              borderRadius: 2,
              bgcolor: 'action.hover'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {entry.memo}
            </Typography>
          </Box>
        ) : null}

        <Stack divider={<Divider flexItem />} spacing={0}>
          {entry.lines.map((line) => (
            <Stack
              key={line.id}
              direction={{ xs: 'column', md: 'row' }}
              spacing={appLayout.fieldGap}
              justifyContent="space-between"
              sx={{ py: { xs: 1.25, md: 1.5 } }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">
                  {line.lineNumber}. {line.accountSubjectCode} {line.accountSubjectName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {line.fundingAccountName
                    ? `자금수단: ${line.fundingAccountName}`
                    : '자금수단 없음'}
                </Typography>
                {line.description ? (
                  <Typography variant="body2" color="text.secondary">
                    {line.description}
                  </Typography>
                ) : null}
              </Stack>
              <Stack
                spacing={0.5}
                alignItems={{ xs: 'flex-start', md: 'flex-end' }}
              >
                <Typography variant="body2">
                  차변 {formatWon(line.debitAmount)}
                </Typography>
                <Typography variant="body2">
                  대변 {formatWon(line.creditAmount)}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </SectionCard>
  );
}

function DetailFact({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {typeof value === 'string' ? (
        <Typography variant="body2">{value}</Typography>
      ) : (
        value
      )}
    </Stack>
  );
}

function buildJournalEntryDescription(entry: JournalEntryItem) {
  const sourceDescription =
    entry.sourceKind === 'COLLECTED_TRANSACTION'
      ? '수집 거래 확정으로 생성된 전표입니다.'
      : entry.sourceKind === 'MANUAL_ADJUSTMENT'
        ? '운영 중 반전 또는 정정으로 생성된 조정 전표입니다.'
        : `출처: ${entry.sourceKind}`;

  return [
    sourceDescription,
    entry.sourceCollectedTransactionTitle
      ? `원본 거래: ${entry.sourceCollectedTransactionTitle}`
      : null
  ]
    .filter(Boolean)
    .join(' ');
}

function readJournalEntrySourceKindLabel(sourceKind: string) {
  switch (sourceKind) {
    case 'COLLECTED_TRANSACTION':
      return '수집 거래 확정';
    case 'PLAN_SETTLEMENT':
      return '계획 정산';
    case 'OPENING_BALANCE':
      return '기초 잔액';
    case 'CARRY_FORWARD':
      return '차기 이월';
    case 'MANUAL_ADJUSTMENT':
      return '수동 조정';
    default:
      return sourceKind;
  }
}

function readJournalEntryTotalAmount(entry: JournalEntryItem) {
  return entry.lines.reduce((total, line) => total + line.debitAmount, 0);
}

function hasAdjustmentMetadata(entry: JournalEntryItem) {
  return buildAdjustmentMetadataRows(entry).length > 0;
}

function buildAdjustmentMetadataRows(entry: JournalEntryItem) {
  return [
    entry.reversesJournalEntryNumber
      ? {
          label: '반전 원본',
          value: entry.reversesJournalEntryNumber
        }
      : null,
    entry.reversedByJournalEntryNumber
      ? {
          label: '후속 반전 전표',
          value: entry.reversedByJournalEntryNumber
        }
      : null,
    entry.correctsJournalEntryNumber
      ? {
          label: '정정 원본',
          value: entry.correctsJournalEntryNumber
        }
      : null,
    entry.correctionEntryNumbers && entry.correctionEntryNumbers.length > 0
      ? {
          label: '후속 정정 전표',
          value: entry.correctionEntryNumbers.join(', ')
        }
      : null,
    entry.correctionReason
      ? {
          label: '정정 사유',
          value: entry.correctionReason
        }
      : null,
    entry.createdByActorType
      ? {
          label: '생성 주체',
          value:
            entry.createdByActorType === 'TENANT_MEMBERSHIP'
              ? entry.createdByMembershipId
                ? `작업 사용자 (${entry.createdByMembershipId})`
                : '작업 사용자'
              : '시스템'
        }
      : null
  ].filter((row): row is { label: string; value: string } => row != null);
}
