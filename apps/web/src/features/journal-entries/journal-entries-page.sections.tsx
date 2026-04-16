'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import type {
  AccountingPeriodItem,
  JournalEntryItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { formatDate, formatWon } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';

export function buildJournalEntryColumns({
  selectedEntryId
}: {
  selectedEntryId?: string | null;
}): GridColDef<JournalEntryItem>[] {
  return [
    {
      field: 'entryNumber',
      headerName: '전표번호',
      flex: 1,
      minWidth: 130,
      renderCell: (params) => (
        <Button
          size="small"
          component={Link}
          href={`/journal-entries/${params.row.id}` as Route}
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
        params.row.id === selectedEntryId ? (
          <Typography variant="caption" color="text.secondary">
            선택됨
          </Typography>
        ) : (
          <Button
            size="small"
            component={Link}
            href={`/journal-entries/${params.row.id}` as Route}
          >
            상세
          </Button>
        )
    }
  ];
}

export function JournalEntriesWorkspace({
  currentPeriod,
  entries,
  isDetailLayout,
  isSplitLayout,
  selectedEntry,
  journalEntryColumns,
  onSelectReverse,
  onSelectCorrect
}: {
  currentPeriod: AccountingPeriodItem | null;
  entries: JournalEntryItem[];
  isDetailLayout: boolean;
  isSplitLayout: boolean;
  selectedEntry: JournalEntryItem | null;
  journalEntryColumns: GridColDef<JournalEntryItem>[];
  onSelectReverse: (entry: JournalEntryItem) => void;
  onSelectCorrect: (entry: JournalEntryItem) => void;
}) {
  if (entries.length === 0) {
    return (
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
    );
  }

  if (isDetailLayout) {
    return selectedEntry ? (
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
              href={
                `/transactions?transactionId=${selectedEntry.sourceCollectedTransactionId}` as Route
              }
              variant="text"
            >
              원본 거래 보기
            </Button>
          ) : null}
        </Stack>
        <JournalEntryDetailCard
          entry={selectedEntry}
          currentPeriod={currentPeriod}
          onReverse={() => onSelectReverse(selectedEntry)}
          onCorrect={() => onSelectCorrect(selectedEntry)}
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
    );
  }

  return (
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
          onReverse={() => onSelectReverse(selectedEntry)}
          onCorrect={() => onSelectCorrect(selectedEntry)}
        />
      ) : null}
    </Stack>
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
            <DetailFact
              label="전표 상태"
              value={<StatusChip label={entry.status} />}
            />
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
                href={
                  `/transactions?transactionId=${entry.sourceCollectedTransactionId}` as Route
                }
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
                  {line.lineNumber}. {line.accountSubjectCode}{' '}
                  {line.accountSubjectName}
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
      ? { label: '반전 원본', value: entry.reversesJournalEntryNumber }
      : null,
    entry.reversedByJournalEntryNumber
      ? { label: '후속 반전 전표', value: entry.reversedByJournalEntryNumber }
      : null,
    entry.correctsJournalEntryNumber
      ? { label: '정정 원본', value: entry.correctsJournalEntryNumber }
      : null,
    entry.correctionEntryNumbers && entry.correctionEntryNumbers.length > 0
      ? {
          label: '후속 정정 전표',
          value: entry.correctionEntryNumbers.join(', ')
        }
      : null,
    entry.correctionReason
      ? { label: '정정 사유', value: entry.correctionReason }
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
